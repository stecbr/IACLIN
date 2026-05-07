import { useQuery } from '@tanstack/react-query';
import { Calendar, Stethoscope, FileText, Users, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SpecialtyHomeShell, getGreeting } from '@/components/dashboard/SpecialtyHomeShell';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { specialtyLabel } from '@/components/SpecialtySelect';

/**
 * Home for the "medical" family (Clínico geral, Cardio, Derma, etc.).
 * Focuses on consultations, pending exam requests and prescriptions.
 */
export default function MedicalHome() {
  const { user, profile, currentClinicId } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';
  const { specialty } = useSpecialtyProfile();
  const specialtyName = specialtyLabel(specialty);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: todayApts = [] } = useQuery({
    queryKey: ['med-today', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', todayStart).lt('start_time', todayEnd)
        .eq('dentist_id', user!.id)
        .order('start_time');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: monthCount = 0 } = useQuery({
    queryKey: ['med-month-count', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', monthStart).lte('start_time', monthEnd)
        .eq('dentist_id', user!.id).eq('status', 'completed');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: pendingRequests = 0 } = useQuery({
    queryKey: ['med-pending-requests', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      const { data: records } = await supabase.from('clinical_records')
        .select('id').eq('dentist_id', user!.id);
      const ids = (records ?? []).map((r) => r.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase.from('clinical_record_requests')
        .select('id', { count: 'exact', head: true })
        .in('clinical_record_id', ids)
        .in('kind', ['exam', 'imaging', 'lab']);
      return count ?? 0;
    },
  });

  const { data: uniquePatients = 0 } = useQuery({
    queryKey: ['med-unique-patients', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('patient_id').eq('dentist_id', user!.id);
      return new Set((data ?? []).map((a: any) => a.patient_id)).size;
    },
  });

  const statusLabels: Record<string, string> = {
    scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Faltou', cancelled: 'Cancelada',
  };
  const statusColors: Record<string, string> = {
    scheduled: 'bg-primary/10 text-primary',
    confirmed: 'bg-success/10 text-success',
    completed: 'bg-success/10 text-success',
    no_show: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <SpecialtyHomeShell
      title={`${getGreeting()}, Dr(a). ${firstName} 🩺`}
      description={`Seja bem-vindo(a)${specialtyName ? ` · ${specialtyName}` : ''} — Resumo das suas consultas, exames e prescrições.`}
      kpis={[
        { title: 'Consultas Hoje', value: todayApts.length, desc: 'na sua agenda', icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
        { title: 'Atendimentos no Mês', value: monthCount, desc: 'concluídos', icon: Stethoscope, color: 'text-success', bg: 'bg-success/10' },
        { title: 'Solicitações Pendentes', value: pendingRequests, desc: 'exames e laudos', icon: FileText, color: 'text-warning', bg: 'bg-warning/10' },
        { title: 'Pacientes Únicos', value: uniquePatients, desc: 'já atendidos', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      ]}
    >
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sua agenda de hoje</CardTitle>
            <Link to="/agenda" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todayApts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma consulta agendada para hoje 🎉</p>
          ) : (
            <div className="space-y-1">
              {todayApts.map((apt: any) => (
                <div key={apt.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                    <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: apt.procedures?.color ?? 'hsl(var(--primary))' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? 'Consulta'}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] rounded-full ${statusColors[apt.status] ?? ''}`}>
                    {statusLabels[apt.status] ?? apt.status}
                  </Badge>
                  <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs">
                    <Link to={`/atendimento/${apt.id}`}>Atender</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </SpecialtyHomeShell>
  );
}