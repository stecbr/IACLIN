import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Stethoscope, Users, Calendar, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  format, startOfMonth, endOfMonth, subMonths, parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'hsl(var(--primary))',
  confirmed: 'hsl(var(--success))',
  completed: 'hsl(217 91% 60%)',
  in_progress: 'hsl(var(--warning))',
  no_show: 'hsl(var(--destructive))',
  cancelled: 'hsl(var(--muted-foreground))',
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  completed: 'Concluída',
  in_progress: 'Em atendimento',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
};

export default function ClinicaHome() {
  const { currentClinicId } = useAuth();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const sixMonthsAgo = startOfMonth(subMonths(now, 5));

  const { data: stats, isLoading } = useQuery({
    queryKey: ['clinica-stats', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const [doctors, patients, appts, revenue] = await Promise.all([
        supabase.from('clinic_members').select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!).eq('role', 'dentist'),
        supabase.from('patients').select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('clinic_id', currentClinicId!)
          .gte('start_time', monthStart.toISOString()).lt('start_time', monthEnd.toISOString()),
        supabase.from('financial_transactions').select('amount')
          .eq('clinic_id', currentClinicId!).eq('type', 'income').eq('status', 'paid')
          .gte('paid_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('paid_date', format(monthEnd, 'yyyy-MM-dd')),
      ]);
      return {
        doctors: doctors.count ?? 0,
        patients: patients.count ?? 0,
        appointments: appts.count ?? 0,
        revenue: (revenue.data ?? []).reduce((s, t: any) => s + Number(t.amount), 0),
      };
    },
  });

  // Receita + despesa 6 meses
  const { data: revenueTxs = [] } = useQuery({
    queryKey: ['clinica-revenue-6m', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('amount, paid_date, type').eq('clinic_id', currentClinicId!).eq('status', 'paid')
        .gte('paid_date', format(sixMonthsAgo, 'yyyy-MM-dd'))
        .lte('paid_date', format(monthEnd, 'yyyy-MM-dd'));
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
    return Object.entries(months).map(([month, d]) => ({ month, ...d }));
  }, [revenueTxs]);

  // Consultas do mês (status + por médico)
  const { data: monthApts = [] } = useQuery({
    queryKey: ['clinica-month-apts', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('status, dentist_id')
        .eq('clinic_id', currentClinicId!)
        .gte('start_time', monthStart.toISOString())
        .lt('start_time', monthEnd.toISOString());
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['clinica-members', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinic_members')
        .select('user_id, role').eq('clinic_id', currentClinicId!).eq('role', 'dentist');
      if (!data?.length) return [];
      const ids = data.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from('profiles')
        .select('id, full_name').in('id', ids);
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        name: profs?.find((p: any) => p.id === m.user_id)?.full_name ?? 'Médico',
      }));
    },
  });

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthApts.forEach((a: any) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts).map(([k, v]) => ({
      name: STATUS_LABELS[k] ?? k, value: v, color: STATUS_COLORS[k] ?? 'hsl(var(--muted))',
    }));
  }, [monthApts]);

  const doctorData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthApts.forEach((a: any) => { counts[a.dentist_id] = (counts[a.dentist_id] ?? 0) + 1; });
    return members
      .map((m) => ({ name: (m.name.split(' ')[0] ?? 'Méd.'), value: counts[m.user_id] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [monthApts, members]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpis = [
    { label: 'Médicos', value: stats?.doctors ?? 0, icon: Stethoscope, color: 'text-primary', bg: 'bg-primary/10', to: '/clinica/medicos' },
    { label: 'Pacientes', value: stats?.patients ?? 0, icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', to: '/patients' },
    { label: 'Consultas no mês', value: stats?.appointments ?? 0, icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', to: '/agenda' },
    { label: 'Receita do mês', value: stats?.revenue ?? 0, icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10', to: '/financial', isCurrency: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral da Clínica"
        description="Indicadores consolidados de toda a operação"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => (
          <Link key={c.label} to={c.to} className="block">
            <Card className="transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{c.label}</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20 mt-2" />
                    ) : (
                      <AnimatedNumber
                        value={c.value}
                        className="text-2xl font-semibold mt-1 tabular-nums block"
                        formatter={c.isCurrency ? fmt : undefined}
                      />
                    )}
                  </div>
                  <div className={`h-11 w-11 rounded-xl ${c.bg} ${c.color} flex items-center justify-center flex-shrink-0`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Receita 6 meses */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" /> Receita vs Despesa
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Últimos 6 meses</p>
            </div>
            <Link to="/financial" className="text-xs text-primary hover:underline">Financeiro</Link>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="income" name="Receita" stroke="hsl(var(--success))" fill="url(#incG)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" name="Despesa" stroke="hsl(var(--destructive))" fill="url(#expG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Status das consultas
            </CardTitle>
            <p className="text-xs text-muted-foreground">Mês atual</p>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Sem dados no período</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Por médico */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" /> Consultas por médico
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Mês atual</p>
          </div>
          <Link to="/clinica/medicos" className="text-xs text-primary hover:underline">Equipe</Link>
        </CardHeader>
        <CardContent>
          {doctorData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum médico cadastrado</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorData} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={90} />
                  <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Bar dataKey="value" name="Consultas" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}