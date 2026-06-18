import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Check,
  FileText,
  Eye,
  X,
  Search,
  Building2,
  Hash,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Stethoscope,
  FolderArchive,
  Landmark,
  Image as ImageIcon,
  StickyNote,
  Users,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DocumentFullscreenViewer, type FullscreenDocFile } from '@/components/operadora/DocumentFullscreenViewer';

interface Req {
  id: string;
  professional_user_id: string;
  requested_by: string | null;
  clinic_id: string;
  clinic_member_id: string;
  status: string;
  notes: string | null;
  requested_at: string;
  updated_at?: string;
  decided_at: string | null;
  rejection_reason: string | null;
  full_name?: string | null;
  requested_by_name?: string | null;
  specialty?: string | null;
  clinic_name?: string | null;
}

interface ClinicProfessional {
  user_id: string;
  full_name: string;
  role: string;
  specialty: string | null;
  registration_number: string | null;
  avatar_url: string | null;
  phone: string | null;
  specialties: string[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  revoked: 'Revogado',
};
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  rejected: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  revoked: 'bg-muted text-muted-foreground border-border',
};

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

export default function OperatorRequests() {
  const { operatorId, user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [revoking, setRevoking] = useState<Req | null>(null);
  const [reason, setReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [detailReq, setDetailReq] = useState<Req | null>(null);
  const [detailProfessionals, setDetailProfessionals] = useState<ClinicProfessional[]>([]);
  const [loadingDetailProfessionals, setLoadingDetailProfessionals] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<ClinicProfessional | null>(null);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [viewerFile, setViewerFile] = useState<FullscreenDocFile | null>(null);

  const isDocumentViewerEvent = (event: Event) => {
    const target = event.target as HTMLElement | null;
    return !!target?.closest('[data-document-fullscreen-viewer]');
  };

  const load = async () => {
    if (!operatorId) { setReqs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('operator_credentialings')
      .select('id, professional_user_id, requested_by, clinic_id, clinic_member_id, status, notes, requested_at, updated_at, decided_at, rejection_reason')
      .eq('operator_id', operatorId)
      .order('requested_at', { ascending: false });
    const all = (data ?? []) as Req[];

    // Keep only latest request per clinic to avoid stale duplicated rows.
    const latestMap = new Map<string, Req>();
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
    const list = Array.from(latestMap.values());
    if (list.length === 0) { setReqs([]); setLoading(false); return; }
    const userIds = [...new Set(list.flatMap((r) => [r.professional_user_id, r.requested_by]).filter(Boolean) as string[])];
    const memberIds = [...new Set(list.map((r) => r.clinic_member_id))];
    const clinicIds = [...new Set(list.map((r) => r.clinic_id))];
    const [{ data: profiles }, { data: members }, { data: clinics }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase.from('clinic_members').select('id, specialty').in('id', memberIds),
      supabase.from('clinics').select('id, name').in('id', clinicIds),
    ]);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const mmap = new Map((members ?? []).map((m) => [m.id, m.specialty]));
    const cmap = new Map((clinics ?? []).map((c) => [c.id, c.name]));
    setReqs(list.map((r) => ({
      ...r,
      full_name: pmap.get(r.professional_user_id) ?? '—',
      requested_by_name: r.requested_by ? pmap.get(r.requested_by) ?? null : null,
      specialty: mmap.get(r.clinic_member_id) ?? null,
      clinic_name: cmap.get(r.clinic_id) ?? '—',
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [operatorId]);

  const approve = async (req: Req) => {
    const { error } = await supabase
      .from('operator_credentialings')
      .update({ status: 'approved', decided_at: new Date().toISOString() })
      .eq('id', req.id);
    if (error) return toast.error('Erro ao aprovar: ' + error.message);
    toast.success('Credenciamento aprovado');
    load();
  };

  const reject = async () => {
    if (!rejecting) return;
    const { error } = await supabase
      .from('operator_credentialings')
      .update({ status: 'rejected', decided_at: new Date().toISOString(), rejection_reason: reason || null })
      .eq('id', rejecting.id);
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Pedido recusado');
    setRejecting(null);
    setReason('');
    load();
  };

  const revoke = async () => {
    if (!revoking) return;
    const { error } = await supabase
      .from('operator_credentialings')
      .update({
        status: 'revoked',
        decided_at: new Date().toISOString(),
        decided_by: user?.id ?? null,
        rejection_reason: revokeReason || 'Credenciamento revogado pela operadora',
      } as any)
      .eq('id', revoking.id);
    if (error) return toast.error('Erro ao revogar: ' + error.message);
    toast.success('Credenciamento revogado');
    setRevoking(null);
    setRevokeReason('');
    load();
  };

  const base = tab === 'pending' ? reqs.filter((r) => r.status === 'pending') : reqs;
  const q = search.trim().toLowerCase();
  const visible = !q
    ? base
    : base.filter((r) =>
        [r.clinic_name, r.full_name, r.requested_by_name, r.specialty]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );

  const parseNotes = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as any;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const loadClinicProfessionals = async () => {
      if (!detailReq?.clinic_id) {
        setDetailProfessionals([]);
        return;
      }

      setLoadingDetailProfessionals(true);
      try {
        const { data: members } = await supabase
          .from('clinic_members')
          .select('user_id, role, specialty, registration_number')
          .eq('clinic_id', detailReq.clinic_id)
          .in('role', ['admin', 'dentist']);

        const rows = (members ?? []) as Array<{
          user_id: string;
          role: string;
          specialty: string | null;
          registration_number: string | null;
        }>;

        if (rows.length === 0) {
          setDetailProfessionals([]);
          return;
        }

        const ids = [...new Set(rows.map((m) => m.user_id))];
        const [{ data: profiles }, { data: profSpecs }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url, phone')
            .in('id', ids),
          supabase
            .from('professional_specialties' as any)
            .select('user_id, specialty')
            .in('user_id', ids),
        ]);

        const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
        const specsMap = new Map<string, string[]>();
        (profSpecs ?? []).forEach((s: any) => {
          const prev = specsMap.get(s.user_id) ?? [];
          specsMap.set(s.user_id, [...prev, s.specialty]);
        });

        setDetailProfessionals(
          rows
            .map((m) => ({
              user_id: m.user_id,
              full_name: pmap.get(m.user_id)?.full_name ?? '—',
              role: m.role,
              specialty: m.specialty,
              registration_number: m.registration_number,
              avatar_url: pmap.get(m.user_id)?.avatar_url ?? null,
              phone: pmap.get(m.user_id)?.phone ?? null,
              specialties: specsMap.get(m.user_id) ?? (m.specialty ? [m.specialty] : []),
            }))
            .sort((a, b) => a.full_name.localeCompare(b.full_name)),
        );
      } finally {
        setLoadingDetailProfessionals(false);
      }
    };

    loadClinicProfessionals();
  }, [detailReq?.clinic_id]);

  const formatBusinessHours = (
    value: unknown,
  ): Array<{ day: string; open?: string; close?: string; closed: boolean; raw?: string }> => {
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const dayLabels: Record<string, string> = {
      mon: 'Segunda',
      tue: 'Terça',
      wed: 'Quarta',
      thu: 'Quinta',
      fri: 'Sexta',
      sat: 'Sábado',
      sun: 'Domingo',
    };

    let parsed: any = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        // Parse plain string like "Segunda: 08:00 - 18:00 Terça: ... Sábado: Fechado"
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

    const rows = dayOrder
      .map((k) => {
        const d = parsed?.[k];
        if (!d || typeof d !== 'object') return null;
        if (d.enabled === false) return { day: dayLabels[k], closed: true };
        return {
          day: dayLabels[k],
          open: d.open ?? '--:--',
          close: d.close ?? '--:--',
          closed: false,
        };
      })
      .filter(Boolean) as Array<{ day: string; open?: string; close?: string; closed: boolean }>;

    return rows;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos de credenciamento</h1>
        <p className="text-sm text-muted-foreground">Aprove ou recuse profissionais que querem entrar na sua rede</p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por clínica, profissional ou especialidade..."
          className="pl-9 rounded-xl"
        />
      </div>
      <div className="inline-flex rounded-full bg-muted p-1">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'pending' ? `Pendentes (${reqs.filter((r) => r.status === 'pending').length})` : 'Todos'}
          </button>
        ))}
      </div>
      {loading ? (
        <Card className="rounded-xl p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : visible.length === 0 ? (
        <Card className="rounded-xl p-8 text-center text-sm text-muted-foreground">Nenhum pedido.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id} className="rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className={`${STATUS_CLASSES[r.status] ?? ''} mb-1.5`}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </Badge>
                  <div className="font-medium">{r.clinic_name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Responsável: {r.requested_by_name ?? r.full_name ?? '—'}{r.specialty ? ` · ${r.specialty}` : ''}
                  </div>
                  {(() => {
                    const parsed = parseNotes(r.notes);
                    const procCount = parsed?.requested_procedures?.length ?? 0;
                    return procCount > 0 ? (
                      <div className="text-xs text-muted-foreground mt-1">{procCount} procedimento(s) selecionado(s)</div>
                    ) : null;
                  })()}
                  {r.rejection_reason && (
                    <div className="text-xs text-destructive mt-1">Motivo: {r.rejection_reason}</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setDetailReq(r)}>
                  <FileText className="h-4 w-4 mr-1" /> Ver dados da clínica
                </Button>
                <div className="flex-1" />
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRejecting(r)}>
                      <X className="h-4 w-4 mr-1" /> Recusar
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={() => approve(r)}>
                      <Check className="h-4 w-4 mr-1" /> Aprovar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar credenciamento</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={reject}>Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
        <DialogContent
          className="max-w-3xl w-[calc(100vw-2rem)] h-[88vh] sm:h-auto sm:max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0 [&>button]:hidden"
          onPointerDownOutside={(e) => {
            if (viewerFile || isDocumentViewerEvent(e.detail.originalEvent)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (viewerFile || isDocumentViewerEvent(e.detail.originalEvent)) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (viewerFile) e.preventDefault();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-background px-6 py-4">
            <DialogHeader className="min-w-0 flex-1 space-y-0 text-left">
              <DialogTitle className="truncate pr-2">Dados da clínica para credenciamento</DialogTitle>
            </DialogHeader>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label="Fechar modal">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
          {detailReq && (() => {
            const data = parseNotes(detailReq.notes);
            const d = data?.dossier ?? null;
            const professional = data?.professional ?? null;
            const clinic = data?.clinic ?? null;
            const contact = data?.contact ?? null;
            const procs = data?.requested_procedures ?? [];
            const documentation = data?.documentation ?? null;
            const docEntityType: 'fisica' | 'juridica' | null = documentation?.entity_type ?? clinic?.entity_type ?? null;
            const docFiles: Array<{ doc_type: string; file_name: string; url: string }> = Array.isArray(documentation?.files) ? documentation.files : [];
            const bank = documentation?.bank ?? null;
            const clinicAddress = [clinic?.address, clinic?.city, clinic?.state]
              .filter(Boolean)
              .join(' · ');
            const businessHoursLines = formatBusinessHours(clinic?.business_hours ?? d?.clinic_hours);

            return (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-5 px-6 py-5 text-sm">
                <section className="rounded-2xl border border-border bg-card/40 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> Informações da clínica
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      { icon: Building2, label: 'Nome da clínica', value: clinic?.name ?? detailReq.clinic_name },
                      { icon: Hash, label: 'CNPJ', value: clinic?.cnpj },
                      { icon: User, label: 'Responsável', value: clinic?.responsible_name ?? contact?.responsible_name },
                      { icon: Phone, label: 'Telefone', value: contact?.phone },
                      { icon: Mail, label: 'E-mail', value: contact?.email },
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
                        <div
                          key={`${row.day}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3.5 py-2.5"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className={`h-1.5 w-1.5 rounded-full ${row.closed ? 'bg-muted-foreground/40' : 'bg-primary'}`} />
                            {row.day || row.raw}
                          </span>
                          {row.closed ? (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">Fechado</Badge>
                          ) : row.open ? (
                            <span className="text-xs font-mono tabular-nums text-foreground/80">
                              {row.open} – {row.close}
                            </span>
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
                    <Users className="h-3.5 w-3.5 text-primary" /> Profissionais desta clínica
                  </h3>
                  {loadingDetailProfessionals ? (
                    <div className="mt-1">Carregando...</div>
                  ) : detailProfessionals.length === 0 ? (
                    <div className="mt-1">—</div>
                  ) : (
                    <div className="space-y-2">
                      {detailProfessionals.map((prof) => (
                        <div key={prof.user_id} className="rounded-xl border border-border/60 p-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={prof.avatar_url ?? undefined} />
                              <AvatarFallback>
                                {(prof.full_name || 'U')
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{prof.full_name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {prof.role === 'admin' ? 'Administrador' : 'Profissional'}
                                {prof.specialty ? ` · ${prof.specialty}` : ''}
                                {prof.registration_number ? ` · ${prof.registration_number}` : ''}
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setSelectedProfessional(prof)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver perfil
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProfessional} onOpenChange={(o) => !o && setSelectedProfessional(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perfil completo do profissional</DialogTitle>
          </DialogHeader>
          {selectedProfessional && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={selectedProfessional.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {(selectedProfessional.full_name || 'U')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{selectedProfessional.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedProfessional.role === 'admin' ? 'Administrador' : 'Profissional'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Telefone</span>
                  <div>{selectedProfessional.phone ?? '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Registro profissional</span>
                  <div>{selectedProfessional.registration_number ?? '—'}</div>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground">Especialidades</span>
                {selectedProfessional.specialties.length === 0 ? (
                  <div>—</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedProfessional.specialties.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revoking} onOpenChange={(o) => !o && setRevoking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar credenciamento</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Motivo da revogação (opcional)"
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl" onClick={() => setRevoking(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={revoke}>Confirmar revogação</Button>
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