import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Stethoscope, Users, Calendar, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

export default function ClinicaHome() {
  const { currentClinicId } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['clinica-stats', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);

      const [doctors, patients, appts] = await Promise.all([
        supabase
          .from('clinic_members')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!)
          .eq('role', 'dentist'),
        supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!)
          .gte('start_time', start.toISOString())
          .lt('start_time', end.toISOString()),
      ]);
      return {
        doctors: doctors.count ?? 0,
        patients: patients.count ?? 0,
        appointments: appts.count ?? 0,
      };
    },
  });

  const cards = [
    { label: 'Médicos', value: stats?.doctors ?? 0, icon: Stethoscope, to: '/clinica/medicos', color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Pacientes', value: stats?.patients ?? 0, icon: Users, to: '/patients', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Consultas no mês', value: stats?.appointments ?? 0, icon: Calendar, to: '/agenda', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral da Clínica" description="Resumo da operação" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="block">
            <Card className="transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{c.label}</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-16 mt-2" />
                    ) : (
                      <p className="text-3xl font-semibold mt-1 tabular-nums">{c.value}</p>
                    )}
                  </div>
                  <div className={`h-11 w-11 rounded-xl ${c.bg} ${c.color} flex items-center justify-center`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {/* Faturamento placeholder */}
        <Card className="opacity-60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Faturamento</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">Em breve</Badge>
              </div>
              <div className="h-11 w-11 rounded-xl bg-muted text-muted-foreground flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Cadastre os médicos da sua clínica em <Link to="/clinica/medicos" className="text-primary hover:underline">Médicos</Link>.</p>
          <p>• Configure horários, salas e procedimentos em <Link to="/settings" className="text-primary hover:underline">Configurações</Link>.</p>
          <p>• Acompanhe agendamentos em tempo real em <Link to="/agenda" className="text-primary hover:underline">Agenda</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}