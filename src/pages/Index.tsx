import { Calendar, Users, DollarSign, AlertTriangle, Plus, UserPlus, CreditCard, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

export default function Index() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Today's appointments count
  const { data: todayCount = 0 } = useQuery({
    queryKey: ['kpi-today-count'],
    queryFn: async () => {
      const { count } = await supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', todayStart).lt('start_time', todayEnd);
      return count ?? 0;
    },
  });

  // Active patients
  const { data: patientCount = 0 } = useQuery({
    queryKey: ['kpi-patient-count'],
    queryFn: async () => {
      const { count } = await supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_active', true);
      return count ?? 0;
    },
  });

  // Monthly revenue
  const { data: monthlyRevenue = 0 } = useQuery({
    queryKey: ['kpi-monthly-revenue'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('amount')
        .eq('type', 'income')
        .eq('status', 'paid')
        .gte('paid_date', monthStart.slice(0, 10))
        .lte('paid_date', monthEnd.slice(0, 10));
      return data?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    },
  });

  // No-show rate
  const { data: noShowRate = 0 } = useQuery({
    queryKey: ['kpi-noshow'],
    queryFn: async () => {
      const { count: total } = await supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', monthStart).lte('start_time', monthEnd);
      const { count: noShow } = await supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', monthStart).lte('start_time', monthEnd).eq('status', 'no_show');
      if (!total || total === 0) return 0;
      return Math.round(((noShow ?? 0) / total) * 100);
    },
  });

  // Upcoming appointments
  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-appointments'],
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', now.toISOString())
        .order('start_time')
        .limit(5);
      return data ?? [];
    },
  });

  // Pending payments
  const { data: pendingPayments = [] } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('*, patients(full_name)')
        .eq('status', 'pending')
        .eq('type', 'income')
        .order('due_date')
        .limit(5);
      return data ?? [];
    },
  });

  // Weekly chart data
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: weekApts = [] } = useQuery({
    queryKey: ['week-chart'],
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('start_time')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString());
      return data ?? [];
    },
  });

  const weekData = weekDays.map((day) => ({
    day: format(day, 'EEE', { locale: ptBR }),
    count: weekApts.filter((a) => isSameDay(parseISO(a.start_time), day)).length,
  }));
  const maxWeek = Math.max(...weekData.map((d) => d.count), 1);

  const kpiCards = [
    {
      title: 'Consultas Hoje',
      value: String(todayCount),
      description: 'agendadas para hoje',
      icon: Calendar,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pacientes Ativos',
      value: String(patientCount),
      description: 'cadastrados',
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Receita do Mês',
      value: `R$ ${monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      description: 'recebido este mês',
      icon: DollarSign,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Taxa No-Show',
      value: `${noShowRate}%`,
      description: 'faltas no mês',
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  const quickActions = [
    { label: 'Nova Consulta', icon: Plus, href: '/agenda' },
    { label: 'Novo Paciente', icon: UserPlus, href: '/patients' },
    { label: 'Registrar Pagamento', icon: CreditCard, href: '/financial' },
  ];

  const statusLabels: Record<string, string> = {
    scheduled: 'Agendada',
    confirmed: 'Confirmada',
    completed: 'Concluída',
    no_show: 'Faltou',
    cancelled: 'Cancelada',
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-primary/10 text-primary',
    confirmed: 'bg-success/10 text-success',
    completed: 'bg-success/10 text-success',
    no_show: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Olá, ${firstName} 👋`}
        description="Aqui está o resumo da sua clínica hoje."
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card
            key={kpi.title}
            className="shadow-card hover:shadow-card-hover transition-shadow border-border/50"
            style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{kpi.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Appointments */}
        <Card className="lg:col-span-2 shadow-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Próximas Consultas</CardTitle>
              <Link to="/agenda" className="text-xs text-primary hover:underline">Ver agenda</Link>
            </div>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma consulta agendada</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((apt: any) => (
                  <div key={apt.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(apt.start_time), 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? 'Consulta'}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${statusColors[apt.status] ?? ''}`}>
                      {statusLabels[apt.status] ?? apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Chart */}
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultas da Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {weekData.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-primary/20 transition-all hover:bg-primary/30"
                    style={{ height: `${Math.max((d.count / maxWeek) * 100, 4)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments */}
      {pendingPayments.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos Pendentes</CardTitle>
              <Link to="/financial" className="text-xs text-primary hover:underline">Ver financeiro</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingPayments.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.patients?.full_name ?? tx.description}</p>
                    <p className="text-xs text-muted-foreground">Venc: {format(parseISO(tx.due_date), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Ações Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="gap-2 border-border/50 hover:bg-accent shadow-card"
              asChild
            >
              <Link to={action.href}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
