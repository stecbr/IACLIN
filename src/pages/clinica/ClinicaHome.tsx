import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Stethoscope, Users, Calendar, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { getClinicTerms } from '@/lib/clinicTerms';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar,
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFinanceVisibility } from '@/hooks/useFinanceVisibility';
import { ClinicFinanceOverview } from '@/components/finance/ClinicFinanceOverview';

// ─── Paleta ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  scheduled:   '#6366f1',
  confirmed:   '#10b981',
  completed:   '#3b82f6',
  in_progress: '#f59e0b',
  no_show:     '#ef4444',
  cancelled:   '#94a3b8',
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída',
  in_progress: 'Em atend.', no_show: 'Faltou', cancelled: 'Cancelada',
};

// ─── Tooltip customizado ────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.stroke ?? e.fill }} />
          <span className="text-muted-foreground">{e.name}:</span>
          <span className="font-medium">{typeof e.value === 'number' && e.name?.includes('R$') ? `R$ ${e.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : e.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.stroke ?? e.fill }} />
          <span className="text-muted-foreground">{e.name}:</span>
          <span className="font-medium">{fmt(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut center label ──────────────────────────────────────────────────────
function DonutCenter({ viewBox, completionRate }: any) {
  const { cx, cy } = viewBox ?? {};
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.4em" fontSize="22" fontWeight="700" fill="currentColor">{completionRate}%</tspan>
      <tspan x={cx} dy="1.4em" fontSize="10" fill="#9ca3af">conclusão</tspan>
    </text>
  );
}

export default function ClinicaHome() {
  const { currentClinicId, clinicCategory } = useAuth();
  const visibility = useFinanceVisibility();
  const terms = getClinicTerms(clinicCategory);
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
    const months: Record<string, { label: string; income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const key = format(m, 'MMM/yy', { locale: ptBR });
      months[key] = { label: key, income: 0, expense: 0 };
    }
    (revenueTxs as any[]).forEach((tx) => {
      if (!tx.paid_date) return;
      const key = format(parseISO(tx.paid_date), 'MMM/yy', { locale: ptBR });
      if (months[key]) {
        if (tx.type === 'income') months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });
    return Object.values(months);
  }, [revenueTxs]);

  // Month transactions for the finance health strip (only when allowed to see clinic cash).
  const { data: monthTxs = [] } = useQuery({
    queryKey: ['clinica-finance-month', currentClinicId, format(monthStart, 'yyyy-MM')],
    enabled: !!currentClinicId && visibility.canSeeClinicCash,
    queryFn: async () => {
      const { data } = await supabase
        .from('financial_transactions')
        .select('amount, status, type, category, approval_status')
        .eq('clinic_id', currentClinicId!)
        .gte('due_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('due_date', format(monthEnd, 'yyyy-MM-dd'));
      return (data ?? []).filter(
        (t: any) => !t.approval_status || t.approval_status === 'approved'
      );
    },
  });

  const { data: monthApts = [] } = useQuery({
    queryKey: ['clinica-month-apts', currentClinicId],
    enabled: !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('status, dentist_id').eq('clinic_id', currentClinicId!)
        .gte('start_time', monthStart.toISOString()).lt('start_time', monthEnd.toISOString());
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
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        name: profs?.find((p: any) => p.id === m.user_id)?.full_name ?? 'Profissional',
      }));
    },
  });

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    (monthApts as any[]).forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([k, v]) => ({ name: STATUS_LABELS[k] ?? k, value: v, fill: STATUS_COLORS[k] ?? '#94a3b8' }))
      .filter(d => d.value > 0);
  }, [monthApts]);

  const doctorData = useMemo(() => {
    const counts: Record<string, number> = {};
    (monthApts as any[]).forEach((a) => { counts[a.dentist_id] = (counts[a.dentist_id] ?? 0) + 1; });
    return members
      .map((m) => ({ name: m.name.split(' ')[0] ?? 'Prof.', value: counts[m.user_id] ?? 0 }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [monthApts, members]);

  const completionRate = useMemo(() => {
    const total = (monthApts as any[]).length;
    const done  = (monthApts as any[]).filter((a) => a.status === 'completed').length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }, [monthApts]);

  const noShowRate = useMemo(() => {
    const total = (monthApts as any[]).length;
    const ns    = (monthApts as any[]).filter((a) => a.status === 'no_show').length;
    return total > 0 ? Math.round((ns / total) * 100) : 0;
  }, [monthApts]);

  const radialData = [
    { name: 'Taxa de conclusão', value: completionRate, fill: '#10b981' },
    { name: 'Taxa de comparecimento', value: Math.max(0, 100 - noShowRate), fill: '#6366f1' },
  ];

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpis = [
    {
      label: terms.teamMembers, value: stats?.doctors ?? 0,
      icon: Stethoscope, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700', to: '/clinica/medicos',
    },
    {
      label: 'Pacientes', value: stats?.patients ?? 0,
      icon: Users, gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700', to: '/patients',
    },
    {
      label: 'Consultas no mês', value: stats?.appointments ?? 0,
      icon: Calendar, gradient: 'bg-gradient-to-br from-blue-500 to-blue-700', to: '/agenda',
    },
    {
      label: 'Receita do mês', value: stats?.revenue ?? 0,
      icon: DollarSign, gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', to: '/financial', isCurrency: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Visão Geral da Clínica" description="Indicadores consolidados de toda a operação" />

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c, i) => (
          <Link key={c.label} to={c.to} className="block">
            <Card
              className="relative overflow-hidden border-0 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ animationDelay: `${i * 70}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
            >
              <div className={`absolute inset-0 opacity-10 ${c.gradient}`} />
              <CardContent className="p-5 relative">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{c.label}</p>
                    {isLoading ? (
                      <Skeleton className="h-8 w-20 mt-2" />
                    ) : (
                      <AnimatedNumber
                        value={c.value}
                        className="text-2xl font-bold mt-1 tabular-nums tracking-tight block"
                        formatter={c.isCurrency ? fmt : undefined}
                      />
                    )}
                  </div>
                  <div className={`h-11 w-11 rounded-xl ${c.gradient} flex items-center justify-center flex-shrink-0`}>
                    <c.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Receita 6 meses + Donut status ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-base">Receita vs Despesa</CardTitle>
              </div>
              <CardDescription>Últimos 6 meses</CardDescription>
            </div>
            <Link to="/financial" className="text-xs text-primary hover:underline">Financeiro</Link>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cl-incG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cl-expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<RevenueTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Area type="monotone" dataKey="income" name="Receita" stroke="#10b981" strokeWidth={2.5} fill="url(#cl-incG)" dot={false} />
                <Area type="monotone" dataKey="expense" name="Despesa" stroke="#ef4444" strokeWidth={2} fill="url(#cl-expG)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base">Status das Consultas</CardTitle>
            </div>
            <CardDescription>Mês atual · {completionRate}% concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="44%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={900}
                    labelLine={false}
                  >
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} stroke="transparent" />)}
                    <DonutCenter completionRate={completionRate} />
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Por profissional + Radial saúde ───────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-base">Consultas por Profissional</CardTitle>
              </div>
              <CardDescription>Mês atual</CardDescription>
            </div>
            <Link to="/clinica/medicos" className="text-xs text-primary hover:underline">Equipe</Link>
          </CardHeader>
          <CardContent>
            {doctorData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Nenhum profissional cadastrado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={doctorData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barSize={20}>
                  <defs>
                    <linearGradient id="cl-barG" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.04 }} />
                  <Bar dataKey="value" name="Consultas" fill="url(#cl-barG)" radius={[0, 6, 6, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saúde da Operação</CardTitle>
            <CardDescription>Indicadores de qualidade do mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius={28} outerRadius={72}
                barSize={14}
                data={radialData}
                startAngle={90} endAngle={-270}
              >
                <RadialBar
                  background={{ fill: 'currentColor', opacity: 0.05 }}
                  dataKey="value"
                  cornerRadius={8}
                  animationDuration={1000}
                />
                <Tooltip content={<ChartTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="space-y-2 pt-2">
              {radialData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{d.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
