import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Recusado',
  revoked: 'Revogado',
};
const STATUS_VARIANT: Record<string, any> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  revoked: 'outline',
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
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

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

  const visible = tab === 'pending' ? reqs.filter((r) => r.status === 'pending') : reqs;

  const parseNotes = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as any;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pedidos de credenciamento</h1>
        <p className="text-sm text-muted-foreground">Aprove ou recuse profissionais que querem entrar na sua rede</p>
      </div>
      <div className="flex gap-2 border-b border-border">
        {(['pending', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'pending' ? `Pendentes (${reqs.filter((r) => r.status === 'pending').length})` : 'Todos'}
          </button>
        ))}
      </div>
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum pedido.</Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium">{r.clinic_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
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
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setDetailReq(r)}>
                  <FileText className="h-4 w-4 mr-1" /> Dossiê
                </Button>
                <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
                {(r.status === 'approved' || r.status === 'pending') && (
                  <Button size="sm" variant="ghost" onClick={() => setRevoking(r)}>
                    Revogar
                  </Button>
                )}
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setRejecting(r)}>
                      <X className="h-4 w-4 mr-1" /> Recusar
                    </Button>
                    <Button size="sm" onClick={() => approve(r)}>
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
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={reject}>Confirmar recusa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dossiê de credenciamento</DialogTitle></DialogHeader>
          {detailReq && (() => {
            const data = parseNotes(detailReq.notes);
            const d = data?.dossier ?? null;
            const professional = data?.professional ?? null;
            const clinic = data?.clinic ?? null;
            const procs = data?.requested_procedures ?? [];
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><span className="text-xs text-muted-foreground">Nome</span><div>{professional?.full_name ?? d?.full_name ?? '—'}</div></div>
                  <div><span className="text-xs text-muted-foreground">CPF</span><div>{professional?.cpf ?? d?.cpf ?? '—'}</div></div>
                  <div><span className="text-xs text-muted-foreground">RG</span><div>{professional?.rg ?? d?.rg ?? '—'}</div></div>
                  <div><span className="text-xs text-muted-foreground">Estado civil</span><div>{professional?.marital_status ?? d?.marital_status ?? '—'}</div></div>
                  <div><span className="text-xs text-muted-foreground">Registro profissional</span><div>{professional?.registration_number ?? d?.professional_register ?? '—'}</div></div>
                  <div><span className="text-xs text-muted-foreground">Especialidades</span><div>{Array.isArray(professional?.specialties) ? professional.specialties.join(', ') : (professional?.specialties ?? d?.specialties ?? '—')}</div></div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Formação</span>
                  <div>{professional?.formation ?? d?.education ?? '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Endereço da clínica</span>
                  <div>{clinic?.address ?? d?.clinic_address ?? '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Horários</span>
                  <div>{clinic?.business_hours ?? d?.clinic_hours ?? '—'}</div>
                </div>

                {((professional?.photo_url || d?.professional_photo_url) || (Array.isArray(clinic?.photos) && clinic.photos.length > 0) || (Array.isArray(d?.clinic_photo_urls) && d.clinic_photo_urls.length > 0)) && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Fotos</span>
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
                  <span className="text-xs text-muted-foreground">Procedimentos solicitados</span>
                  {procs.length === 0 ? (
                    <div>—</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {procs.map((p: any) => (
                        <Badge key={p.id ?? p.name} variant="secondary">{p.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {(d?.notes || clinic?.notes) && (
                  <div>
                    <span className="text-xs text-muted-foreground">Observações</span>
                    <div>{d?.notes ?? clinic?.notes}</div>
                  </div>
                )}
              </div>
            );
          })()}
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
            <Button variant="ghost" onClick={() => setRevoking(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={revoke}>Confirmar revogação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}