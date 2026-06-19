import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfDay, endOfDay } from 'date-fns';
import { Users, UserCheck, Play, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import {
  WaitingRoomCard,
  type WaitingRoomAppointment,
} from '@/components/waiting-room/WaitingRoomCard';
import { FinishPaymentDialog, type FinishProcedure } from '@/components/attendance/FinishPaymentDialog';

export default function WaitingRoom() {
  const { currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentApt, setPaymentApt] = useState<{
    id: string;
    patientId: string;
    patientName: string;
    patientInsuranceProvider: string | null;
    procedures: FinishProcedure[];
  } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  // Doctors of the clinic for filter dropdown
  const { data: doctors = [] } = useQuery({
    queryKey: ['waiting-room-doctors', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data: members } = await supabase
        .from('clinic_members')
        .select('user_id, specialty')
        .eq('clinic_id', currentClinicId)
        .in('role', ['admin', 'dentist']);
      if (!members?.length) return [];
      const ids = members.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return members.map((m) => ({
        user_id: m.user_id,
        full_name: profileMap.get(m.user_id) ?? 'Profissional',
        specialty: m.specialty,
      }));
    },
    enabled: !!currentClinicId,
  });

  const doctorMap = useMemo(() => {
    const m = new Map<string, { full_name: string; specialty: string | null }>();
    doctors.forEach((d) => m.set(d.user_id, { full_name: d.full_name, specialty: d.specialty }));
    return m;
  }, [doctors]);

  // Today's appointments
  const { data: appointments = [], refetch, isLoading, isError } = useQuery({
    queryKey: ['waiting-room', currentClinicId, todayStart, doctorFilter],
    queryFn: async () => {
      if (!currentClinicId) return [];
      let query = supabase
        .from('appointments')
        .select(
          'id, start_time, end_time, status, presence_status, arrived_at, service_started_at, patient_id, dentist_id, patients(full_name, photo_url), procedures(name, color)'
        )
        .eq('clinic_id', currentClinicId)
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .not('status', 'in', '(cancelled)')
        .order('start_time');
      if (doctorFilter !== 'all') {
        query = query.eq('dentist_id', doctorFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WaitingRoomAppointment[];
    },
    enabled: !!currentClinicId,
    refetchInterval: 60_000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!currentClinicId) return;
    const channel = supabase
      .channel(`waiting-room-${currentClinicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `clinic_id=eq.${currentClinicId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['waiting-room', currentClinicId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinicId, queryClient]);

  const enriched: WaitingRoomAppointment[] = useMemo(
    () =>
      appointments.map((a) => ({
        ...a,
        dentist_name: doctorMap.get(a.dentist_id)?.full_name ?? null,
        dentist_specialty: doctorMap.get(a.dentist_id)?.specialty ?? null,
      })),
    [appointments, doctorMap]
  );

  const waiting = enriched.filter((a) => a.presence_status === 'not_arrived');
  const arrived = enriched.filter((a) => a.presence_status === 'arrived');
  const inService = enriched.filter((a) => a.presence_status === 'in_service');
  const finished = enriched.filter(
    (a) => a.presence_status === 'finished' || a.presence_status === 'no_show'
  );

  const updatePresence = async (
    id: string,
    presence: 'arrived' | 'in_service' | 'finished' | 'no_show'
  ) => {
    setBusyId(id);
    try {
      const updates: { presence_status: string; status?: string } = { presence_status: presence };
      if (presence === 'finished') updates.status = 'completed';
      if (presence === 'no_show') updates.status = 'no_show';
      const { error } = await supabase.from('appointments').update(updates).eq('id', id);
      if (error) throw error;

      const labels: Record<string, string> = {
        arrived: 'Paciente marcado como presente',
        in_service: 'Atendimento iniciado',
        finished: 'Atendimento finalizado',
        no_show: 'Marcado como falta',
      };
      toast.success(labels[presence]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar status';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleRegisterPayment = async (appointmentId: string) => {
    setLoadingPayment(true);
    try {
      // Verifica se já existe transação financeira para esta consulta
      const { data: existingTx } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('appointment_id', appointmentId)
        .limit(1)
        .maybeSingle();
      if (existingTx) {
        toast.info('Esta consulta já possui um lançamento financeiro. Edite em Financeiro.');
        return;
      }

      // Carrega procedimentos do prontuário desta consulta
      const { data: apt, error: aptErr } = await supabase
        .from('appointments')
        .select('id, patient_id, patients(full_name, insurance_provider)')
        .eq('id', appointmentId)
        .single();
      if (aptErr) throw aptErr;

      const { data: record } = await supabase
        .from('clinical_records')
        .select('id, clinical_record_procedures(procedure_id, price, procedures(name, code))')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      const procedures: FinishProcedure[] = ((record as any)?.clinical_record_procedures ?? []).map((p: any) => ({
        procedure_id: p.procedure_id ?? '',
        name: p.procedures?.name ?? 'Procedimento',
        code: p.procedures?.code ?? null,
        price: Number(p.price) || 0,
      }));

      setPaymentApt({
        id: appointmentId,
        patientId: (apt as any).patient_id,
        patientName: (apt as any).patients?.full_name ?? 'Paciente',
        patientInsuranceProvider: (apt as any).patients?.insurance_provider ?? null,
        procedures,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados de pagamento';
      toast.error(msg);
    } finally {
      setLoadingPayment(false);
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <p className="text-sm text-destructive font-medium">Não foi possível carregar a sala de espera.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sala de Espera"
        description="Acompanhe a chegada e o atendimento dos pacientes do dia"
      >
        <div className="flex items-center gap-2">
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os profissionais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.user_id} value={d.user_id}>
                  Dr(a). {d.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Aguardados" value={waiting.length} icon={<Users className="h-4 w-4" />} />
        <KpiTile
          label="Na recepção"
          value={arrived.length}
          icon={<UserCheck className="h-4 w-4" />}
          accent="amber"
        />
        <KpiTile
          label="Em atendimento"
          value={inService.length}
          icon={<Play className="h-4 w-4" />}
          accent="emerald"
        />
        <KpiTile label="Finalizados" value={finished.length} icon={<UserCheck className="h-4 w-4" />} />
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Column
          title="Aguardados"
          subtitle="Pacientes que ainda não chegaram"
          count={waiting.length}
          color="muted"
        >
          {waiting.length === 0 ? (
            <EmptyMini text={isLoading ? 'Carregando...' : 'Nenhum paciente aguardando.'} />
          ) : (
            waiting.map((a) => (
              <WaitingRoomCard
                key={a.id}
                appointment={a}
                busyId={busyId}
                onMarkArrived={(id) => updatePresence(id, 'arrived')}
                onMarkInService={(id) => updatePresence(id, 'in_service')}
                onMarkFinished={(id) => updatePresence(id, 'finished')}
                onMarkNoShow={(id) => updatePresence(id, 'no_show')}
              />
            ))
          )}
        </Column>

        <Column
          title="Na recepção"
          subtitle="Pacientes que já chegaram"
          count={arrived.length}
          color="amber"
        >
          {arrived.length === 0 ? (
            <EmptyMini text="Ninguém aguardando atendimento agora." />
          ) : (
            arrived.map((a) => (
              <WaitingRoomCard
                key={a.id}
                appointment={a}
                busyId={busyId}
                onMarkArrived={(id) => updatePresence(id, 'arrived')}
                onMarkInService={(id) => updatePresence(id, 'in_service')}
                onMarkFinished={(id) => updatePresence(id, 'finished')}
                onMarkNoShow={(id) => updatePresence(id, 'no_show')}
              />
            ))
          )}
        </Column>

        <Column
          title="Em atendimento"
          subtitle="Consultas em andamento"
          count={inService.length}
          color="emerald"
        >
          {inService.length === 0 ? (
            <EmptyMini text="Nenhum atendimento em curso." />
          ) : (
            inService.map((a) => (
              <WaitingRoomCard
                key={a.id}
                appointment={a}
                busyId={busyId}
                onMarkArrived={(id) => updatePresence(id, 'arrived')}
                onMarkInService={(id) => updatePresence(id, 'in_service')}
                onMarkFinished={(id) => updatePresence(id, 'finished')}
                onMarkNoShow={(id) => updatePresence(id, 'no_show')}
                onRegisterPayment={handleRegisterPayment}
              />
            ))
          )}
        </Column>
      </div>

      {!isLoading && enriched.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhuma consulta hoje"
          description="Quando houver agendamentos para o dia, eles aparecerão aqui."
        />
      )}

      {paymentApt && (
        <FinishPaymentDialog
          open={!!paymentApt}
          onOpenChange={(o) => { if (!o) setPaymentApt(null); }}
          appointmentId={paymentApt.id}
          patientId={paymentApt.patientId}
          patientName={paymentApt.patientName}
          clinicId={currentClinicId ?? null}
          patientInsuranceProvider={paymentApt.patientInsuranceProvider}
          procedures={paymentApt.procedures}
          onCompleted={() => {
            setPaymentApt(null);
            queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
          }}
        />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'amber' | 'emerald';
}) {
  const accentClass =
    accent === 'amber'
      ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10'
      : accent === 'emerald'
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
      : 'text-muted-foreground bg-muted';
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accentClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Column({
  title,
  subtitle,
  count,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: 'muted' | 'amber' | 'emerald';
  children: React.ReactNode;
}) {
  const headerColor =
    color === 'amber'
      ? 'border-t-amber-500'
      : color === 'emerald'
      ? 'border-t-emerald-500'
      : 'border-t-border';
  return (
    <div className={`rounded-xl border border-border border-t-4 ${headerColor} bg-muted/20 p-3 space-y-3`}>
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-background rounded-full px-2 py-0.5 border border-border">
          {count}
        </span>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="text-center text-xs text-muted-foreground py-8 px-4 border border-dashed border-border rounded-lg">
      {text}
    </div>
  );
}