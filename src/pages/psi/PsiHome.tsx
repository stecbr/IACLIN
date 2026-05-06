import { useQuery } from '@tanstack/react-query';
import { Brain, Calendar, Users, Heart, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SpecialtyHomeShell, getGreeting } from '@/components/dashboard/SpecialtyHomeShell';

export default function PsiHome() {
  const { user, profile, currentClinicId } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const wkStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const wkEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const mStart = startOfMonth(now).toISOString();
  const mEnd = endOfMonth(now).toISOString();

  const { data: todaySessions = [] } = useQuery({
    queryKey: ['psi-today', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('appointments')
        .select('*, patients(full_name)')
        .gte('start_time', todayStart).lt('start_time', todayEnd)
        .eq('dentist_id', user!.id).order('start_time');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: weekCount = 0 } = useQuery({
    queryKey: ['psi-week', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', wkStart).lte('start_time', wkEnd)
        .eq('dentist_id', user!.id);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: activePatients = 0 } = useQuery({
    queryKey: ['psi-active', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('patient_id').eq('dentist_id', user!.id);
      return new Set((data ?? []).map((a: any) => a.patient_id)).size;
    },
  });

  const { data: monthSessions = 0 } = useQuery({
    queryKey: ['psi-month', user?.id, currentClinicId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', mStart).lte('start_time', mEnd)
        .eq('dentist_id', user!.id).eq('status', 'completed');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  return (
    <SpecialtyHomeShell
      title={`${getGreeting()}, ${firstName} 🧠`}
      description="Acompanhamento das suas sessões e evolução terapêutica."
      kpis={[
        { title: 'Sessões Hoje', value: todaySessions.length, desc: 'na sua agenda', icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
        { title: 'Sessões na Semana', value: weekCount, desc: 'agendadas + realizadas', icon: Brain, color: 'text-success', bg: 'bg-success/10' },
        { title: 'Pacientes Ativos', value: activePatients, desc: 'em acompanhamento', icon: Users, color: 'text-warning', bg: 'bg-warning/10' },
        { title: 'Sessões no Mês', value: monthSessions, desc: 'finalizadas', icon: Heart, color: 'text-blue-500', bg: 'bg-blue-500/10' },
      ]}
    >
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessões de hoje</CardTitle>
            <Link to="/agenda" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma sessão hoje 🌿</p>
          ) : (
            <div className="space-y-1">
              {todaySessions.map((apt: any) => (
                <div key={apt.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                    <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground">Sessão terapêutica</p>
                  </div>
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