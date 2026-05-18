import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Req {
  id: string;
  professional_user_id: string;
  clinic_id: string;
  clinic_member_id: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  rejection_reason: string | null;
  full_name?: string | null;
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
  const { operatorId } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'pending' | 'all'>('pending');

  const load = async () => {
    if (!operatorId) { setReqs([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('operator_credentialings')
      .select('id, professional_user_id, clinic_id, clinic_member_id, status, requested_at, decided_at, rejection_reason')
      .eq('operator_id', operatorId)
      .order('requested_at', { ascending: false });
    const list = (data ?? []) as Req[];
    if (list.length === 0) { setReqs([]); setLoading(false); return; }
    const userIds = [...new Set(list.map((r) => r.professional_user_id))];
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

  const visible = tab === 'pending' ? reqs.filter((r) => r.status === 'pending') : reqs;

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
                <div className="font-medium">{r.full_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.clinic_name}{r.specialty ? ` · ${r.specialty}` : ''}
                </div>
                {r.rejection_reason && (
                  <div className="text-xs text-destructive mt-1">Motivo: {r.rejection_reason}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABELS[r.status] ?? r.status}</Badge>
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
    </div>
  );
}