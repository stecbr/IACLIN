import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Check, X, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AiRequest {
  id: string;
  clinic_id: string;
  patient_name: string | null;
  patient_phone: string;
  patient_id: string | null;
  requested_at: string;
  specialty: string | null;
  procedure: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  suggested_dentist_id: string | null;
}

interface Dentist {
  user_id: string;
  full_name: string | null;
  role: string;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface PanelProps {
  // compact: usado na Agenda — só aparece quando há pedidos pendentes, sem
  // título grande nem botão de sincronizar (vira um aviso enxuto).
  compact?: boolean;
}

export function AiAppointmentRequestsPanel({ compact = false }: PanelProps = {}) {
  const { currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selected, setSelected] = useState<AiRequest | null>(null);
  const [dentistId, setDentistId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [durationMin, setDurationMin] = useState<string>('30');
  const [reason, setReason] = useState<string>('');

  const requestsQuery = useQuery({
    queryKey: ['ai-appointment-requests', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ai_appointment_requests')
        .select('*')
        .eq('clinic_id', currentClinicId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AiRequest[];
    },
  });

  const dentistsQuery = useQuery({
    queryKey: ['clinic-dentists-for-ai', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from('clinic_members')
        .select('user_id, role')
        .eq('clinic_id', currentClinicId!)
        .in('role', ['admin', 'dentist']);
      if (error) throw error;
      const ids = (members || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [] as Dentist[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const byId = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      return (members || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: byId.get(m.user_id) ?? 'Profissional',
        role: m.role,
      })) as Dentist[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!currentClinicId) return;
    const ch = supabase
      .channel(`ai-appt-req-${currentClinicId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_appointment_requests', filter: `clinic_id=eq.${currentClinicId}` },
        () => qc.invalidateQueries({ queryKey: ['ai-appointment-requests', currentClinicId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentClinicId, qc]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinicId) throw new Error('Sem clínica');
      const { data, error } = await supabase.functions.invoke('sync-ai-appointments', {
        body: { clinicId: currentClinicId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Sincronizado: ${data?.synced ?? 0} novo(s) de ${data?.total ?? 0}`);
      qc.invalidateQueries({ queryKey: ['ai-appointment-requests', currentClinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Falha ao sincronizar'),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !dentistId || !startTime) throw new Error('Preencha todos os campos');
      const { data, error } = await supabase.functions.invoke('approve-ai-appointment-request', {
        body: {
          requestId: selected.id,
          dentistId,
          startTime: new Date(startTime).toISOString(),
          durationMin: Number(durationMin) || 30,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Consulta aprovada e criada na agenda');
      setApproveOpen(false);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['ai-appointment-requests', currentClinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Falha ao aprovar'),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Sem pedido');
      const { data, error } = await supabase.functions.invoke('reject-ai-appointment-request', {
        body: { requestId: selected.id, reason: reason || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Pedido rejeitado');
      setRejectOpen(false);
      setSelected(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['ai-appointment-requests', currentClinicId] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Falha ao rejeitar'),
  });

  const openApprove = (r: AiRequest) => {
    setSelected(r);
    setStartTime(toLocalInput(r.requested_at));
    setDurationMin('30');
    const available = dentistsQuery.data ?? [];
    const suggested = r.suggested_dentist_id &&
      available.some((d) => d.user_id === r.suggested_dentist_id)
      ? r.suggested_dentist_id
      : (available[0]?.user_id ?? '');
    setDentistId(suggested);
    setApproveOpen(true);
  };

  const openReject = (r: AiRequest) => {
    setSelected(r);
    setReason('');
    setRejectOpen(true);
  };

  const requests = requestsQuery.data ?? [];

  // Modo compacto (Agenda): só renderiza se houver pedidos pendentes — funciona
  // como um aviso. Quando vazio, não ocupa espaço.
  if (compact && !requestsQuery.isLoading && requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={compact ? 'rounded-xl border-primary/30 bg-primary/5 shadow-sm' : 'rounded-xl shadow-sm'}>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {compact ? `Pedidos de agendamento (${requests.length})` : 'Pedidos de Agendamento da IA'}
            </CardTitle>
            <CardDescription>
              {compact
                ? 'Pedidos do WhatsApp aguardando sua aprovação.'
                : 'Fila de pedidos vindos do WhatsApp aguardando aprovação.'}
            </CardDescription>
          </div>
          {!compact && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !currentClinicId}
              className="gap-2"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar agora
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {requestsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum pedido pendente no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.patient_name ?? 'Paciente WhatsApp'}</span>
                      <Badge variant="secondary" className="text-xs">IA</Badge>
                      {r.specialty && <Badge variant="outline" className="text-xs">{r.specialty}</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.patient_phone}</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(r.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openReject(r)}>
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                    <Button size="sm" className="gap-1" onClick={() => openApprove(r)}>
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar pedido</DialogTitle>
            <DialogDescription>
              Escolha o profissional e ajuste o horário se necessário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <p className="text-sm">
                {selected?.patient_name ?? 'Paciente WhatsApp'} — {selected?.patient_phone}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Profissional</Label>
              <Select value={dentistId} onValueChange={setDentistId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(dentistsQuery.data ?? []).map((d) => (
                    <SelectItem key={d.user_id} value={d.user_id}>
                      {d.full_name} {d.role === 'admin' ? '(admin)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (min)</Label>
                <Input type="number" min={5} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancelar</Button>
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || !dentistId}>
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar pedido</DialogTitle>
            <DialogDescription>Opcional: informe um motivo.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}