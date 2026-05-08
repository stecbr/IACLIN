import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfDay, endOfDay } from 'date-fns';
import { CalendarDays, Users, Play, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useActiveConsultation } from '@/hooks/useActiveConsultation';
import { startSession } from '@/lib/consultationSession';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DayAppointmentRow,
  type DayAppointment,
} from '@/components/patients-of-day/DayAppointmentRow';

export default function PatientsOfDay() {
  const { currentClinicId, user } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const active = useActiveConsultation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<string>('all');

  const isDentist = effectiveRole === 'dentist';
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  // Doctors list for admin filter
  // Whether clinic has a secretary/admin OTHER than the current user.
  // If yes and current user is dentist, they cannot mark arrival.
  const { data: hasReceptionStaff = false } = useQuery({
    queryKey: ['pod-has-reception', currentClinicId, user?.id],
    enabled: !!currentClinicId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_members')
        .select('user_id, role')
        .eq('clinic_id', currentClinicId!)
        .in('role', ['admin', 'secretary']);
      return (data ?? []).some((m) => m.user_id !== user!.id);
    },
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['pod-doctors', currentClinicId],
    enabled: !!currentClinicId && !isDentist,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', currentClinicId!)
        .in('role', ['admin', 'dentist']);
      const ids = (members ?? []).map((m) => m.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids);
      return (profiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? 'Profissional' }));
    },
  });

  const dentistIdFilter = isDentist ? user?.id : doctorFilter === 'all' ? null : doctorFilter;

  const { data: appointments = [], refetch, isLoading } = useQuery({
    queryKey: ['patients-of-day', currentClinicId, todayStart, dentistIdFilter],
    enabled: !!currentClinicId,
    queryFn: async () => {
      let q = supabase
        .from('appointments')
        .select(
          'id, start_time, end_time, status, presence_status, service_started_at, patient_id, dentist_id, patients(full_name, photo_url), procedures(name, color)'
        )
        .eq('clinic_id', currentClinicId!)
        .gte('start_time', todayStart)
        .lte('start_time', todayEnd)
        .not('status', 'in', '(cancelled)')
        .order('start_time');
      if (dentistIdFilter) q = q.eq('dentist_id', dentistIdFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DayAppointment[];
    },
  });

  // Hydrate dentist names for admin view
  const { data: dentistNameMap = {} } = useQuery({
    queryKey: ['pod-dentist-names', appointments.map((a) => a.dentist_id).join(',')],
    enabled: !isDentist && appointments.length > 0,
    queryFn: async () => {
      const ids = [...new Set(appointments.map((a) => a.dentist_id))];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        m[p.id] = p.full_name ?? 'Profissional';
      });
      return m;
    },
  });

  // Realtime
  useEffect(() => {
    if (!currentClinicId) return;
    const ch = supabase
      .channel(`pod-${currentClinicId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `clinic_id=eq.${currentClinicId}` },
        () => queryClient.invalidateQueries({ queryKey: ['patients-of-day', currentClinicId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentClinicId, queryClient]);

  const enriched = useMemo(
    () => appointments.map((a) => ({ ...a, dentist_name: dentistNameMap[a.dentist_id] ?? null })),
    [appointments, dentistNameMap]
  );

  const total = enriched.length;
  const waiting = enriched.filter((a) => a.presence_status === 'not_arrived' || a.presence_status === 'arrived').length;
  const inService = enriched.filter((a) => a.presence_status === 'in_service').length;
  const finished = enriched.filter((a) => a.presence_status === 'finished').length;

  const handleStart = async (a: DayAppointment) => {
    setBusyId(a.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('appointments')
        .update({
          presence_status: 'in_service',
          status: 'in_progress',
          service_started_at: a.service_started_at ?? nowIso,
        })
        .eq('id', a.id);
      if (error) throw error;
      startSession({
        appointmentId: a.id,
        patientId: a.patient_id,
        patientName: a.patients?.full_name,
        startedAt: a.service_started_at ?? nowIso,
      });
      navigate(`/atendimento/${a.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar atendimento');
    } finally {
      setBusyId(null);
    }
  };

  const handleArrived = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ presence_status: 'arrived' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Paciente marcado como presente');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pacientes do Dia"
        description="Veja e inicie os atendimentos da sua agenda de hoje"
      >
        <div className="flex items-center gap-2">
          {!isDentist && (
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os profissionais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr(a). {d.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="Total do dia" value={total} icon={<CalendarDays className="h-4 w-4" />} />
        <KpiTile label="Aguardando" value={waiting} icon={<Users className="h-4 w-4" />} accent="amber" />
        <KpiTile label="Em atendimento" value={inService} icon={<Play className="h-4 w-4" />} accent="emerald" />
        <KpiTile label="Finalizados" value={finished} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-sm text-muted-foreground py-12">Carregando...</div>
        ) : enriched.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma consulta hoje"
            description="Quando houver agendamentos para o dia, eles aparecerão aqui."
          />
        ) : (
          enriched.map((a) => (
            <DayAppointmentRow
              key={a.id}
              appointment={a}
              busy={busyId === a.id}
              showDentist={!isDentist}
              isActiveSession={active?.appointmentId === a.id}
              onStart={() => handleStart(a)}
              onResume={() => navigate(`/atendimento/${a.id}`)}
              canMarkArrived={!isDentist || !hasReceptionStaff}
              onMarkArrived={() => handleArrived(a.id)}
              onOpenPatient={() => navigate(`/patients/${a.patient_id}`)}
            />
          ))
        )}
      </div>
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
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accentClass}`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}