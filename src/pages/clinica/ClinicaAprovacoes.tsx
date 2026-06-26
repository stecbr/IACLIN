import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardCheck, Loader2, Calendar as CalIcon, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { syncAgendaAppointments } from '@/hooks/useAiSync';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ApprovalCard, type AppointmentRequest } from '@/components/clinica/ApprovalCard';
import { BudgetApprovalCard, type BudgetApprovalRequest } from '@/components/clinica/BudgetApprovalCard';
import { RescheduleDialog } from '@/components/clinica/RescheduleDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

export default function ClinicaAprovacoes() {
  const { currentClinicId } = useAuth();
  const qc = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);
  const [rescheduleReq, setRescheduleReq] = useState<AppointmentRequest | null>(null);
  const [rejectReq, setRejectReq] = useState<AppointmentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [budgetActingId, setBudgetActingId] = useState<string | null>(null);
  const [budgetRejectReq, setBudgetRejectReq] = useState<BudgetApprovalRequest | null>(null);
  const [budgetRejectReason, setBudgetRejectReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['appointment-requests', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('*')
        .eq('clinic_id', currentClinicId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      // Enrich with dentist names + avatars
      const dentistIds = Array.from(new Set((data ?? []).map((r) => r.dentist_id)));
      const patientIds = Array.from(new Set((data ?? []).map((r) => r.patient_user_id).filter(Boolean)));
      const allProfileIds = Array.from(new Set([...dentistIds, ...patientIds]));

      const { data: profiles } = allProfileIds.length
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', allProfileIds)
        : { data: [] as Array<{ id: string; full_name: string | null; avatar_url: string | null }> };
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      return (data ?? []).map((r) => ({
        ...r,
        dentist_name: profileMap.get(r.dentist_id)?.full_name ?? '—',
        dentist_avatar_url: profileMap.get(r.dentist_id)?.avatar_url ?? null,
        patient_avatar_url: profileMap.get(r.patient_user_id)?.avatar_url ?? null,
      })) as AppointmentRequest[];
    },
    enabled: !!currentClinicId,
  });

  // Realtime
  useEffect(() => {
    if (!currentClinicId) return;
    const channel = supabase
      .channel(`appointment_requests_${currentClinicId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointment_requests', filter: `clinic_id=eq.${currentClinicId}` },
        () => qc.invalidateQueries({ queryKey: ['appointment-requests', currentClinicId] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'treatment_plans' },
        () => qc.invalidateQueries({ queryKey: ['budget-approvals', currentClinicId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinicId, qc]);

  // Orçamentos aguardando aprovação da clínica
  const { data: budgetRequests = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budget-approvals', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plans')
        .select('*, patients!inner(id, full_name, clinic_id), treatment_plan_items(custom_procedure_name, price, procedures(name))')
        .eq('patients.clinic_id', currentClinicId!)
        .in('status', ['awaiting_clinic_approval', 'pending', 'rejected_by_clinic'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const dentistIds = Array.from(new Set(rows.map((r) => r.dentist_id).filter(Boolean)));
      let dentistMap: Record<string, string> = {};
      if (dentistIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', dentistIds);
        dentistMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return rows.map((r) => ({
        ...r,
        patient_name: r.patients?.full_name,
        dentist_name: dentistMap[r.dentist_id] ?? '—',
        items: (r.treatment_plan_items ?? []).map((it: any) => ({
          name: it.procedures?.name ?? it.custom_procedure_name ?? 'Item',
          price: Number(it.price ?? 0),
        })),
      })) as BudgetApprovalRequest[];
    },
  });

  const pending = requests.filter((r) => r.status === 'pending');
  const approved = requests.filter((r) => r.status === 'approved');
  const rejected = requests.filter((r) => r.status === 'rejected');

  const budgetPending = budgetRequests.filter((r) => r.status === 'awaiting_clinic_approval');
  const budgetApproved = budgetRequests.filter((r) => r.status === 'pending');
  const budgetRejected = budgetRequests.filter((r) => r.status === 'rejected_by_clinic');

  const approve = async (req: AppointmentRequest, newStart?: string, newEnd?: string) => {
    if (actingId) return;
    setActingId(req.id);
    try {
      const { data, error } = await supabase.functions.invoke('approve-appointment-request', {
        body: { requestId: req.id, newStartTime: newStart, newEndTime: newEnd },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Consulta aprovada e agendada.');
      setRescheduleReq(null);
      qc.invalidateQueries({ queryKey: ['appointment-requests', currentClinicId] });
      qc.invalidateQueries({ queryKey: ['patients-of-day'] });
      qc.invalidateQueries({ queryKey: ['today-apt-count'] });
      qc.invalidateQueries({ queryKey: ['pending-requests-count'] });
      // Notifica o backend da IA → dispara automação "Confirmação" no WhatsApp.
      if (currentClinicId) void syncAgendaAppointments(currentClinicId);
    } catch (err: any) {
      toast.error('Falha ao aprovar', { description: err?.message });
    } finally {
      setActingId(null);
    }
  };

  const reject = async () => {
    if (!rejectReq || actingId) return;
    setActingId(rejectReq.id);
    try {
      const { data, error } = await supabase.functions.invoke('reject-appointment-request', {
        body: { requestId: rejectReq.id, reason: rejectReason.trim() || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Pedido recusado.');
      setRejectReq(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['appointment-requests', currentClinicId] });
      qc.invalidateQueries({ queryKey: ['pending-requests-count'] });
      // Notifica o backend da IA → dispara automação "Reagendamento" no WhatsApp
      // caso houvesse um appointment vinculado que foi marcado como cancelled.
      if (currentClinicId) void syncAgendaAppointments(currentClinicId);
    } catch (err: any) {
      toast.error('Falha ao recusar', { description: err?.message });
    } finally {
      setActingId(null);
    }
  };

  const renderList = (list: AppointmentRequest[]) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3 text-muted-foreground">
            <ClipboardCheck className="h-8 w-8" />
            <p className="text-sm">Nada por aqui.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => (
          <ApprovalCard
            key={r.id}
            request={r}
            loading={actingId === r.id}
            onApprove={() => approve(r)}
            onReschedule={() => setRescheduleReq(r)}
            onReject={() => setRejectReq(r)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações de consulta"
        description="Solicitações enviadas pelos pacientes via app."
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Recusadas ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">{renderList(pending)}</TabsContent>
        <TabsContent value="approved" className="mt-4">{renderList(approved)}</TabsContent>
        <TabsContent value="rejected" className="mt-4">{renderList(rejected)}</TabsContent>
      </Tabs>

      {rescheduleReq && (
        <RescheduleDialog
          open={!!rescheduleReq}
          onOpenChange={(o) => !o && setRescheduleReq(null)}
          currentStart={rescheduleReq.start_time}
          currentEnd={rescheduleReq.end_time}
          loading={actingId === rescheduleReq.id}
          onConfirm={(s, e) => approve(rescheduleReq, s, e)}
        />
      )}

      <AlertDialog open={!!rejectReq} onOpenChange={(o) => { if (!o) { setRejectReq(null); setRejectReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um motivo. O paciente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: horário indisponível"
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Recusar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}