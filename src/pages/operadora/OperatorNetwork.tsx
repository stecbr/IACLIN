import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Building2, MapPin, Stethoscope, Users, Eye, Phone, Mail, FileText, IdCard, Calendar, User as UserIcon, Hash, Clock, FolderArchive, Landmark, Image as ImageIcon, StickyNote, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';
import { DocumentFullscreenViewer, type FullscreenDocFile } from '@/components/operadora/DocumentFullscreenViewer';

const DOC_LABELS: Record<string, string> = {
  cro_dentista: 'CRO/CRM do profissional',
  cro_clinica: 'CRO/CRM da clínica (responsável técnico)',
  cartao_cnpj: 'Cartão CNPJ',
  contrato_social: 'Contrato Social',
  alvara: 'Alvará de funcionamento',
  licenca_sanitaria: 'Licença sanitária',
  cnes_doc: 'Comprovante CNES',
  fotos_clinica: 'Fotos da clínica',
  especializacao: 'Certificado de especialização',
};

function parseNotes(raw: string | null | undefined) {
  if (!raw) return null;
  try { return JSON.parse(raw) as any; } catch { return null; }
}

function formatBusinessHours(
  value: unknown,
): Array<{ day: string; open?: string; close?: string; closed: boolean; raw?: string }> {
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayLabels: Record<string, string> = {
    mon: 'Segunda', tue: 'Terça', wed: 'Quarta', thu: 'Quinta', fri: 'Sexta', sat: 'Sábado', sun: 'Domingo',
  };
  let parsed: any = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch {
      const dayNames = Object.values(dayLabels);
      const regex = new RegExp(
        `(${dayNames.join('|')}):\\s*(Fechado|\\d{1,2}:\\d{2}\\s*[-–às]+\\s*\\d{1,2}:\\d{2})`,
        'gi',
      );
      const matches = Array.from(value.matchAll(regex));
      if (matches.length === 0) return [{ day: '', closed: false, raw: value }];
      return matches.map((m) => {
        const day = m[1];
        const rest = m[2].trim();
        if (/fechado/i.test(rest)) return { day, closed: true };
        const times = rest.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
        return { day, open: times?.[1], close: times?.[2], closed: false };
      });
    }
  }
  if (!parsed || typeof parsed !== 'object') return [];
  return dayOrder
    .map((k) => {
      const d = parsed?.[k];
      if (!d || typeof d !== 'object') return null;
      if (d.enabled === false) return { day: dayLabels[k], closed: true };
      return { day: dayLabels[k], open: d.open ?? '--:--', close: d.close ?? '--:--', closed: false };
    })
    .filter(Boolean) as Array<{ day: string; open?: string; close?: string; closed: boolean }>;
}

function InfoField({
  icon, label, value, className,
}: { icon: React.ReactNode; label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm truncate">{value || '—'}</div>
    </div>
  );
}

interface Doctor {
  user_id: string;
  name: string;
  avatar_url: string | null;
  specialty: string | null;
  specialties: string[];
  registration_number: string | null;
  is_owner: boolean;
  created_at: string | null;
}

interface Row {
  id: string;
  clinic_id: string;
  status: string;
  requested_at?: string;
  updated_at?: string;
  notes?: string | null;
  clinic_name?: string | null;
  clinic_cnpj?: string | null;
  clinic_city?: string | null;
  clinic_phone?: string | null;
  clinic_email?: string | null;
  clinic_address?: string | null;
  clinic_neighborhood?: string | null;
  clinic_state?: string | null;
  clinic_category?: string | null;
  clinic_category_label?: string | null;
  clinic_logo_url?: string | null;
  clinic_responsible?: string | null;
  clinic_created_at?: string | null;
  doctors?: Doctor[];
}

export default function OperatorNetwork() {
  const { operatorId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'medico' | 'odonto'>('all');
  const [operatorType, setOperatorType] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Row | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [doctorViewing, setDoctorViewing] = useState<Doctor | null>(null);
  const [viewerFile, setViewerFile] = useState<FullscreenDocFile | null>(null);

  const isDocumentViewerEvent = (event: Event) => {
    const target = event.target as HTMLElement | null;
    return !!target?.closest('[data-document-fullscreen-viewer]');
  };

  const load = async () => {
    if (!operatorId) return;
    setLoading(true);
    const { data: creds } = await supabase
      .from('operator_credentialings')
      .select('id, clinic_id, status, requested_at, updated_at, notes')
      .eq('operator_id', operatorId)
      .order('requested_at', { ascending: false });
    const all = (creds ?? []) as Row[];

    // Keep only the latest credentialing per clinic for this operator.
    const latestMap = new Map<string, Row>();
    for (const row of all) {
      const key = row.clinic_id;
      const prev = latestMap.get(key);
      if (!prev) {
        latestMap.set(key, row);
        continue;
      }
      const prevTs = new Date(prev.requested_at ?? prev.updated_at ?? 0).getTime();
      const currTs = new Date(row.requested_at ?? row.updated_at ?? 0).getTime();
      if (currTs >= prevTs) latestMap.set(key, row);
    }
    const list = Array.from(latestMap.values()).filter((r) => r.status === 'approved');

    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const clinicIds = [...new Set(list.map((r) => r.clinic_id))];
    const [{ data: clinics }, { data: clinicMembers }, { data: profiles }] = await Promise.all([
      supabase.from('clinics').select('id, name, city, cnpj, phone, email, address, neighborhood, state, category, category_label, logo_url, responsible_name, created_at').in('id', clinicIds),
      supabase.from('clinic_members').select('id, clinic_id, user_id, specialty, registration_number, role, is_owner, created_at').in('clinic_id', clinicIds).in('role', ['admin', 'dentist']),
      supabase.from('profiles').select('id, full_name, avatar_url'),
    ]);

    const memberIds = (clinicMembers ?? []).map((m: any) => m.id);
    const { data: extraSpecs } = memberIds.length > 0
      ? await supabase.from('clinic_member_specialties').select('clinic_member_id, specialty').in('clinic_member_id', memberIds)
      : { data: [] as any[] };
    const specsByMember = new Map<string, string[]>();
    (extraSpecs ?? []).forEach((s: any) => {
      const arr = specsByMember.get(s.clinic_member_id) ?? [];
      if (s.specialty) arr.push(s.specialty);
      specsByMember.set(s.clinic_member_id, arr);
    });

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const clinicMap = new Map((clinics ?? []).map((c) => [c.id, c]));
    const doctorsByClinic = new Map<string, Doctor[]>();
    (clinicMembers ?? []).forEach((m: any) => {
      const arr = doctorsByClinic.get(m.clinic_id) ?? [];
      const extra = specsByMember.get(m.id) ?? [];
      const merged = Array.from(new Set([m.specialty, ...extra].filter(Boolean))) as string[];
      arr.push({
        user_id: m.user_id,
        name: profileMap.get(m.user_id)?.full_name ?? '—',
        avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        specialty: m.specialty ?? null,
        specialties: merged,
        registration_number: m.registration_number ?? null,
        is_owner: !!m.is_owner,
        created_at: m.created_at ?? null,
      });
      doctorsByClinic.set(m.clinic_id, arr);
    });

    const merged: Row[] = list.map((r) => {
      const c: any = clinicMap.get(r.clinic_id);
      const doctorList = doctorsByClinic.get(r.clinic_id) ?? [];
      const owner = doctorList.find((d) => d.is_owner);
      const responsibleFromOwner = owner?.name && owner.name !== '—' ? owner.name : null;
      return {
        ...r,
        notes: r.notes ?? null,
        clinic_name: c?.name ?? '—',
        clinic_cnpj: c?.cnpj ?? null,
        clinic_city: c?.city ?? null,
        clinic_phone: c?.phone ?? null,
        clinic_email: c?.email ?? null,
        clinic_address: c?.address ?? null,
        clinic_neighborhood: c?.neighborhood ?? null,
        clinic_state: c?.state ?? null,
        clinic_category: c?.category ?? null,
        clinic_category_label: c?.category_label ?? null,
        clinic_logo_url: c?.logo_url ?? null,
        clinic_responsible: c?.responsible_name ?? responsibleFromOwner ?? null,
        clinic_created_at: c?.created_at ?? null,
        doctors: doctorList,
      };
    });
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [operatorId]);

  useEffect(() => {
    if (!operatorId) return;
    supabase.from('insurance_operators').select('type').eq('id', operatorId).maybeSingle()
      .then(({ data }: any) => setOperatorType(data?.type ?? null));
  }, [operatorId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== 'all' && (r.clinic_category ?? '') !== categoryFilter) return false;
      if (!term) return true;
      return [
        r.clinic_name,
        r.clinic_city,
        r.clinic_cnpj,
        ...(r.doctors ?? []).flatMap((d) => [d.name, d.specialty, d.registration_number]),
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(term));
    });
  }, [rows, q, categoryFilter]);

  const revokeCredentialing = async () => {
    if (!revoking || !operatorId) return;
    setBusyId(revoking.id);
    const { error } = await supabase
      .from('operator_credentialings')
      .update({
        status: 'revoked',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        rejection_reason: revokeReason || 'Revogado pela operadora (rede credenciada)',
      } as any)
      .eq('operator_id', operatorId)
      .eq('clinic_id', revoking.clinic_id)
      .eq('status', 'approved');

    setBusyId(null);
    if (error) {
      toast.error('Erro ao revogar credenciamento: ' + error.message);
      return;
    }
    toast.success('Credenciamento cancelado na rede');
    setRevoking(null);
    setRevokeReason('');
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rede credenciada</h1>
        <p className="text-sm text-muted-foreground">Clínicas credenciadas e médicos vinculados</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por clínica, médico, especialidade, cidade..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 w-full rounded-xl"
          />
        </div>
        {operatorType === 'ambos' && (
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs">
            {([
              { v: 'all',    label: 'Todas' },
              { v: 'medico', label: 'Médicas' },
              { v: 'odonto', label: 'Odontológicas' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setCategoryFilter(opt.v)}
                className={
                  'px-3 py-1.5 rounded-lg transition-colors ' +
                  (categoryFilter === opt.v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <Card className="rounded-xl p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma clínica credenciada ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
            {filtered.map((r) => {
              const specialties = Array.from(
                new Set((r.doctors ?? []).map((d) => d.specialty).filter(Boolean) as string[])
              );
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{r.clinic_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.clinic_cnpj ?? '—'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {r.clinic_city ?? '—'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {r.doctors?.length ?? 0} médico(s)
                    </span>
                  </div>

                  {specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                          {s}
                        </Badge>
                      ))}
                      {specialties.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          +{specialties.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl flex-1"
                      onClick={() => setViewing(r)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => setRevoking(r)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent
          className="max-w-3xl w-[calc(100vw-2rem)] h-[88vh] sm:h-auto sm:max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0 [&>button]:hidden"
          onPointerDownOutside={(e) => {
            if (viewerFile || isDocumentViewerEvent(e.detail.originalEvent)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (viewerFile || isDocumentViewerEvent(e.detail.originalEvent)) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => { if (viewerFile) e.preventDefault(); }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-background px-6 py-4">
            <DialogHeader className="min-w-0 flex-1 space-y-0 text-left">
              <DialogTitle className="truncate pr-2">Dados da clínica credenciada</DialogTitle>
            </DialogHeader>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label="Fechar modal">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          {viewing && (() => {
            const data = parseNotes(viewing.notes);
            const d = data?.dossier ?? null;
            const professional = data?.professional ?? null;
            const clinic = data?.clinic ?? null;
            const contact = data?.contact ?? null;
            const procs = data?.requested_procedures ?? [];
            const documentation = data?.documentation ?? null;
            const docEntityType: 'fisica' | 'juridica' | null = documentation?.entity_type ?? clinic?.entity_type ?? null;
            const docFiles: Array<{ doc_type: string; file_name: string; url: string }> = Array.isArray(documentation?.files) ? documentation.files : [];
            const bank = documentation?.bank ?? null;
            const clinicAddress = [clinic?.address ?? viewing.clinic_address, clinic?.city ?? viewing.clinic_city, clinic?.state ?? viewing.clinic_state]
              .filter(Boolean).join(' · ');
            const businessHoursLines = formatBusinessHours(clinic?.business_hours ?? d?.clinic_hours);

            return (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-5 px-6 py-5 text-sm">
                {/* Cabeçalho compacto */}
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-border">
                    {viewing.clinic_logo_url ? (
                      <img src={viewing.clinic_logo_url} alt={viewing.clinic_name ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold leading-tight truncate">{clinic?.name ?? viewing.clinic_name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {viewing.clinic_category_label && (
                        <Badge variant="secondary" className="text-[10px] font-normal">{viewing.clinic_category_label}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-normal inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />{viewing.doctors?.length ?? 0} médico(s)
                      </Badge>
                      {viewing.clinic_created_at && (
                        <Badge variant="outline" className="text-[10px] font-normal inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />Desde {new Date(viewing.clinic_created_at).toLocaleDateString('pt-BR')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <section className="rounded-2xl border border-border bg-card/40 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Informações da clínica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      { icon: Building2, label: 'Nome da clínica', value: clinic?.name ?? viewing.clinic_name },
                      { icon: Hash, label: 'CNPJ', value: clinic?.cnpj ?? viewing.clinic_cnpj },
                      { icon: UserIcon, label: 'Responsável', value: clinic?.responsible_name ?? contact?.responsible_name ?? viewing.clinic_responsible },
                      { icon: Phone, label: 'Telefone', value: contact?.phone ?? viewing.clinic_phone },
                      { icon: Mail, label: 'E-mail', value: contact?.email ?? viewing.clinic_email },
                      { icon: MapPin, label: 'CEP', value: clinic?.zip_code },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5 min-w-0">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                          <div className="text-sm font-medium truncate">{value || '—'}</div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-2.5 min-w-0 md:col-span-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Endereço completo</div>
                        <div className="text-sm font-medium">{clinicAddress || '—'}</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card/40 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Horários de atendimento
                  </h3>
                  {businessHoursLines.length === 0 ? (
                    <div className="text-sm text-muted-foreground">—</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {businessHoursLines.map((row, i) => (
                        <div key={`${row.day}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3.5 py-2.5">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className={`h-1.5 w-1.5 rounded-full ${row.closed ? 'bg-muted-foreground/40' : 'bg-primary'}`} />
                            {row.day || row.raw}
                          </span>
                          {row.closed ? (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Fechado</Badge>
                          ) : row.open ? (
                            <span className="text-xs font-mono tabular-nums text-foreground/80">{row.open} – {row.close}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {((professional?.photo_url || d?.professional_photo_url) || (Array.isArray(clinic?.photos) && clinic.photos.length > 0) || (Array.isArray(d?.clinic_photo_urls) && d.clinic_photo_urls.length > 0)) && (
                  <div className="space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" /> Fotos
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(professional?.photo_url || d?.professional_photo_url) && (
                        <a href={professional?.photo_url ?? d?.professional_photo_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Foto profissional</a>
                      )}
                      {(clinic?.photos ?? d?.clinic_photo_urls ?? []).map((url: string, i: number) => (
                        <a key={url + i} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Foto clínica {i + 1}</a>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Stethoscope className="h-3.5 w-3.5 text-primary" /> Procedimentos solicitados
                  </h3>
                  {procs.length === 0 ? (
                    <div>—</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {procs.map((p: any) => (
                        <Badge key={p.id ?? p.name} variant="secondary">{p.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FolderArchive className="h-3.5 w-3.5 text-primary" /> Documentação enviada
                      {docEntityType && (
                        <span className="font-normal normal-case tracking-normal">
                          ({docEntityType === 'fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'})
                        </span>
                      )}
                    </h3>
                    {docFiles.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{docFiles.length} arquivo(s)</span>
                    )}
                  </div>
                  {docFiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum documento enviado.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {docFiles.map((f, i) => {
                        const label = DOC_LABELS[f.doc_type] ?? f.doc_type;
                        return (
                          <button
                            key={`${f.url}-${i}`}
                            type="button"
                            onClick={() => setViewerFile({ url: f.url, file_name: f.file_name, label })}
                            className="flex items-center gap-2 rounded-xl border border-border p-2 hover:bg-muted/40 transition-colors min-w-0 text-left"
                          >
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{label}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{f.file_name}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {bank && (bank.bank_name || bank.agency || bank.account) && (
                    <div className="rounded-xl border border-border p-3 mt-2 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Landmark className="h-3.5 w-3.5 text-primary" /> Dados bancários
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Banco</span><div>{bank.bank_name ?? '—'}</div></div>
                        <div><span className="text-muted-foreground">Agência</span><div>{bank.agency ?? '—'}</div></div>
                        <div><span className="text-muted-foreground">Conta</span><div>{bank.account ?? '—'}</div></div>
                        <div><span className="text-muted-foreground">Titular</span><div>{bank.holder_name ?? '—'}</div></div>
                      </div>
                    </div>
                  )}
                </div>

                {(d?.notes || clinic?.notes) && (
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5 text-primary" /> Observações
                    </h3>
                    <div>{d?.notes ?? clinic?.notes}</div>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" /> Médicos vinculados ({viewing.doctors?.length ?? 0})
                  </h3>
                  {viewing.doctors && viewing.doctors.length > 0 ? (
                    <div className="rounded-xl border border-border divide-y divide-border">
                      {viewing.doctors.map((doc, i) => (
                        <div key={`${doc.user_id}-${i}`} className="px-3 py-3 flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border">
                            {doc.avatar_url && <AvatarImage src={doc.avatar_url} alt={doc.name} />}
                            <AvatarFallback className="text-xs font-medium text-white" style={{ backgroundColor: getAvatarColor(doc.user_id) }}>
                              {getInitials(doc.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{doc.name}</span>
                              {doc.is_owner && <Badge variant="secondary" className="text-[9px] font-normal">Owner</Badge>}
                              {doc.registration_number && (
                                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <IdCard className="h-3 w-3" />{doc.registration_number}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {doc.specialties.length > 0 ? (
                                doc.specialties.map((s) => (
                                  <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Sem especialidade</span>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="rounded-xl shrink-0" onClick={() => setDoctorViewing(doc)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />Ver perfil
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Sem médicos vinculados.</div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-3">
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => { setRevoking(viewing); setViewing(null); }}
            >
              Cancelar credenciamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Perfil do médico */}
      <Dialog open={!!doctorViewing} onOpenChange={(o) => !o && setDoctorViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Perfil do médico</DialogTitle>
          </DialogHeader>
          {doctorViewing && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-col items-center text-center gap-3 pt-2">
                <Avatar className="h-20 w-20 border border-border">
                  {doctorViewing.avatar_url && <AvatarImage src={doctorViewing.avatar_url} alt={doctorViewing.name} />}
                  <AvatarFallback
                    className="text-xl font-medium text-white"
                    style={{ backgroundColor: getAvatarColor(doctorViewing.user_id) }}
                  >
                    {getInitials(doctorViewing.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-lg font-semibold">{doctorViewing.name}</div>
                  {doctorViewing.registration_number && (
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                      <IdCard className="h-3 w-3" />
                      {doctorViewing.registration_number}
                    </div>
                  )}
                </div>
                {doctorViewing.is_owner && (
                  <Badge variant="secondary" className="text-[10px] font-normal">Owner da clínica</Badge>
                )}
              </div>

              <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" />
                  Especialidades
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {doctorViewing.specialties.length > 0 ? (
                    doctorViewing.specialties.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem especialidade cadastrada</span>
                  )}
                </div>
              </div>

              {doctorViewing.created_at && (
                <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Vinculado em {new Date(doctorViewing.created_at).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setDoctorViewing(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar credenciamento da rede</DialogTitle>
          </DialogHeader>
          <Textarea
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setRevoking(null)}>Voltar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={revokeCredentialing} disabled={busyId === revoking?.id}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentFullscreenViewer
        file={viewerFile}
        open={!!viewerFile}
        onClose={() => setViewerFile(null)}
      />
    </div>
  );
}