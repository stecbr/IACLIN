import { Calendar, Users, DollarSign, AlertTriangle, Plus, UserPlus, CreditCard, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays, eachDayOfInterval as eachDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { MiniSparkline } from '@/components/dashboard/MiniSparkline';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import DentistHome from '@/pages/dentist/DentistHome';
import MedicalHome from '@/pages/medical/MedicalHome';
import NutritionHome from '@/pages/nutrition/NutritionHome';
import PsiHome from '@/pages/psi/PsiHome';
import { useSpecialtyProfile } from '@/hooks/useSpecialtyProfile';
import { SoloModeBanner } from '@/components/dashboard/SoloModeBanner';

export default function IndexRouter() {
  const { effectiveRole } = useRoleAccess();
  if (effectiveRole === 'dentist') return <DentistRouter />;
  return <AdminHome />;
}

function DentistRouter() {
  const { profile } = useSpecialtyProfile();
  switch (profile.family) {
    case 'medical':
    case 'aesthetic':
      return <MedicalHome />;
    case 'nutrition':
      return <NutritionHome />;
    case 'psi':
      return <PsiHome />;
    case 'odonto':
    case 'physio':
    case 'podology':
    case 'generic':
    default:
      return <DentistHome />;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function AdminHome() {
  const { profile, currentClinicId } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: todayCount = 0 } = useQuery({
    queryKey: ['kpi-today-count', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', todayStart).lt('start_time', todayEnd);
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { count } = await query;
      return count ?? 0;
    },
  });

  const { data: patientCount = 0 } = useQuery({
    queryKey: ['kpi-patient-count', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('patients').select('id', { count: 'exact', head: true }).eq('is_active', true);
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { count } = await query;
      return count ?? 0;
    },
  });

  const { data: monthlyRevenue = 0 } = useQuery({
    queryKey: ['kpi-monthly-revenue', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('financial_transactions')
        .select('amount')
        .eq('type', 'income').eq('status', 'paid')
        .gte('paid_date', monthStart.slice(0, 10))
        .lte('paid_date', monthEnd.slice(0, 10));
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return data?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    },
  });

  const { data: noShowRate = 0 } = useQuery({
    queryKey: ['kpi-noshow', currentClinicId],
    queryFn: async () => {
      let q1 = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', monthStart).lte('start_time', monthEnd);
      let q2 = supabase.from('appointments').select('id', { count: 'exact', head: true })
        .gte('start_time', monthStart).lte('start_time', monthEnd).eq('status', 'no_show');
      if (currentClinicId) { q1 = q1.eq('clinic_id', currentClinicId); q2 = q2.eq('clinic_id', currentClinicId); }
      const { count: total } = await q1;
      const { count: noShow } = await q2;
      if (!total || total === 0) return 0;
      return Math.round(((noShow ?? 0) / total) * 100);
    },
  });

  // Last 7 days appointment counts for sparkline
  const { data: last7DayCounts = [] } = useQuery({
    queryKey: ['sparkline-7d', currentClinicId],
    queryFn: async () => {
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      const start = subDays(now, 6).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      let query = supabase.from('appointments').select('start_time').gte('start_time', start).lt('start_time', end);
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return days.map(d => (data ?? []).filter(a => isSameDay(parseISO(a.start_time), d)).length);
    },
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['upcoming-appointments', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', now.toISOString())
        .order('start_time').limit(5);
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return data ?? [];
    },
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ['pending-payments', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('financial_transactions')
        .select('*, patients(full_name)')
        .eq('status', 'pending').eq('type', 'income')
        .order('due_date').limit(5);
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return data ?? [];
    },
  });

  // Revenue chart (last 6 months)
  const sixMonthsAgo = subMonths(now, 5);
  const { data: revenueTxs = [] } = useQuery({
    queryKey: ['revenue-chart-6m', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('financial_transactions')
        .select('amount, paid_date, type')
        .eq('status', 'paid')
        .gte('paid_date', format(startOfMonth(sixMonthsAgo), 'yyyy-MM-dd'))
        .lte('paid_date', format(endOfMonth(now), 'yyyy-MM-dd'));
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return data ?? [];
    },
  });

  const revenueChartData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      months[format(m, 'MMM', { locale: ptBR })] = { income: 0, expense: 0 };
    }
    revenueTxs.forEach((tx: any) => {
      if (!tx.paid_date) return;
      const key = format(parseISO(tx.paid_date), 'MMM', { locale: ptBR });
      if (months[key]) {
        if (tx.type === 'income') months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [revenueTxs]);

  // Weekly appointments chart
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: weekApts = [] } = useQuery({
    queryKey: ['week-chart', currentClinicId],
    queryFn: async () => {
      let query = supabase.from('appointments')
        .select('start_time')
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString());
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      const { data } = await query;
      return data ?? [];
    },
  });

  const weekData = weekDays.map((day) => ({
    day: format(day, 'EEE', { locale: ptBR }),
    count: weekApts.filter((a) => isSameDay(parseISO(a.start_time), day)).length,
  }));
  const maxWeek = Math.max(...weekData.map((d) => d.count), 1);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpiCards = [
    {
      title: 'Consultas Hoje',
      value: todayCount,
      description: 'agendadas para hoje',
      icon: Calendar,
      color: 'text-primary',
      gradientFrom: 'from-primary/10',
      gradientTo: 'to-primary/5',
      iconBg: 'bg-gradient-to-br from-primary/20 to-primary/10',
      sparkColor: 'hsl(var(--primary))',
    },
    {
      title: 'Pacientes Ativos',
      value: patientCount,
      description: 'cadastrados',
      icon: Users,
      color: 'text-success',
      gradientFrom: 'from-success/10',
      gradientTo: 'to-success/5',
      iconBg: 'bg-gradient-to-br from-success/20 to-success/10',
      sparkColor: 'hsl(var(--success))',
    },
    {
      title: 'Receita do Mês',
      value: monthlyRevenue,
      description: 'recebido este mês',
      icon: DollarSign,
      color: 'text-warning',
      gradientFrom: 'from-warning/10',
      gradientTo: 'to-warning/5',
      iconBg: 'bg-gradient-to-br from-warning/20 to-warning/10',
      sparkColor: 'hsl(var(--warning))',
      isCurrency: true,
    },
    {
      title: 'Taxa No-Show',
      value: noShowRate,
      description: 'faltas no mês',
      icon: AlertTriangle,
      color: 'text-destructive',
      gradientFrom: 'from-destructive/10',
      gradientTo: 'to-destructive/5',
      iconBg: 'bg-gradient-to-br from-destructive/20 to-destructive/10',
      sparkColor: 'hsl(var(--destructive))',
      isPercentage: true,
    },
  ];

  const statusLabels: Record<string, string> = { scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Faltou', cancelled: 'Cancelada' };
  const statusColors: Record<string, string> = { scheduled: 'bg-primary/10 text-primary', confirmed: 'bg-success/10 text-success', completed: 'bg-success/10 text-success', no_show: 'bg-destructive/10 text-destructive', cancelled: 'bg-muted text-muted-foreground' };

  return (
    <div className="space-y-8">
      <PageHeader title={`${getGreeting()}, ${firstName} 👋`} description="Seja bem-vindo(a)! Aqui está o resumo da sua clínica hoje." />
      <SoloModeBanner />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card
            key={kpi.title}
            className="group relative overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/50 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
          >
            {/* Subtle gradient background on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.gradientFrom} ${kpi.gradientTo} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`h-9 w-9 rounded-xl ${kpi.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-end justify-between">
                <div>
                  <AnimatedNumber
                    value={kpi.value}
                    className="text-2xl font-semibold text-foreground"
                    formatter={kpi.isCurrency ? (v) => fmt(v) : kpi.isPercentage ? (v) => `${Math.round(v)}%` : undefined}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                </div>
                <MiniSparkline data={last7DayCounts.length > 0 ? last7DayCounts : [0, 0]} color={kpi.sparkColor} className="opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart + Weekly */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receita Mensal</CardTitle>
              <Link to="/financial" className="text-xs text-primary hover:underline">Ver financeiro</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Area type="monotone" dataKey="income" name="Receita" stroke="hsl(var(--success))" fill="url(#incomeGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
                    className="w-full rounded-t-md bg-gradient-to-t from-primary/30 to-primary/10 transition-all hover:from-primary/40 hover:to-primary/20"
                    style={{ height: `${Math.max((d.count / maxWeek) * 100, 4)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground capitalize">{d.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming + Pending */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card border-border/50">
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
              <div className="space-y-1">
                {upcoming.map((apt: any) => (
                  <div key={apt.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                      <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                    </div>
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: (apt as any).procedures?.color ?? 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? 'Consulta'}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] rounded-full ${statusColors[apt.status] ?? ''}`}>
                      {statusLabels[apt.status] ?? apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {pendingPayments.length > 0 && (
          <Card className="shadow-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos Pendentes</CardTitle>
                <Link to="/financial" className="text-xs text-primary hover:underline">Ver financeiro</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {pendingPayments.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.patients?.full_name ?? tx.description}</p>
                      <p className="text-xs text-muted-foreground">Venc: {format(parseISO(tx.due_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{fmt(Number(tx.amount))}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Ações Rápidas</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Nova Consulta', icon: Plus, href: '/agenda' },
            { label: 'Novo Paciente', icon: UserPlus, href: '/patients' },
            { label: 'Registrar Pagamento', icon: CreditCard, href: '/financial' },
          ].map((action) => (
            <Button key={action.label} variant="outline" className="gap-2 border-border/50 hover:bg-accent shadow-card hover:shadow-card-hover transition-all" asChild>
              <Link to={action.href}><action.icon className="h-4 w-4" />{action.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
