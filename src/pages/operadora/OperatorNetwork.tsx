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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Detalhes da clínica</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5 text-sm">
              {/* Cabeçalho da clínica */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-border">
                  {viewing.clinic_logo_url ? (
                    <img src={viewing.clinic_logo_url} alt={viewing.clinic_name ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold leading-tight truncate">{viewing.clinic_name}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {viewing.clinic_category_label && (
                      <Badge variant="secondary" className="text-[10px] font-normal">{viewing.clinic_category_label}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-normal inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {viewing.doctors?.length ?? 0} médico(s)
                    </Badge>
                    {viewing.clinic_created_at && (
                      <Badge variant="outline" className="text-[10px] font-normal inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Desde {new Date(viewing.clinic_created_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid de info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border p-3 bg-muted/30">
                <InfoField icon={<FileText className="h-3.5 w-3.5" />} label="CNPJ" value={viewing.clinic_cnpj} />
                <InfoField icon={<UserIcon className="h-3.5 w-3.5" />} label="Responsável" value={viewing.clinic_responsible} />
                <InfoField icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={viewing.clinic_phone} />
                <InfoField icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={viewing.clinic_email} />
                <InfoField
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Endereço"
                  value={[viewing.clinic_address, viewing.clinic_neighborhood].filter(Boolean).join(', ') || null}
                  className="sm:col-span-2"
                />
                <InfoField
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Cidade / UF"
                  value={[viewing.clinic_city, viewing.clinic_state].filter(Boolean).join(' - ') || null}
                  className="sm:col-span-2"
                />
              </div>

              {/* Lista de médicos */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" />
                  Médicos vinculados ({viewing.doctors?.length ?? 0})
                </div>
                {viewing.doctors && viewing.doctors.length > 0 ? (
                  <div className="rounded-lg border border-border divide-y divide-border max-h-80 overflow-y-auto">
                    {viewing.doctors.map((d, i) => (
                      <div key={`${d.user_id}-${i}`} className="px-3 py-3 flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-border">
                          {d.avatar_url && <AvatarImage src={d.avatar_url} alt={d.name} />}
                          <AvatarFallback
                            className="text-xs font-medium text-white"
                            style={{ backgroundColor: getAvatarColor(d.user_id) }}
                          >
                            {getInitials(d.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{d.name}</span>
                            {d.is_owner && (
                              <Badge variant="secondary" className="text-[9px] font-normal">Owner</Badge>
                            )}
                            {d.registration_number && (
                              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                <IdCard className="h-3 w-3" />
                                {d.registration_number}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {d.specialties.length > 0 ? (
                              d.specialties.map((s) => (
                                <Badge key={s} variant="outline" className="text-[10px] font-normal">
                                  {s}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Sem especialidade</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl shrink-0"
                          onClick={() => setDoctorViewing(d)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Ver perfil
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sem médicos vinculados.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                setRevoking(viewing);
                setViewing(null);
              }}
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
    </div>
  );
}