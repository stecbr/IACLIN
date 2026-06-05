import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchAdminData } from '@/hooks/usePlatformAdminData';
import {
  Building2, Stethoscope, Users,
  AlertTriangle, CheckCircle, Clock, XCircle, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PlatformStats, PlatformClinic } from '@/types/superadmin';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
  RadialBarChart, RadialBar,
} from 'recharts';
import { ClinicsMapWidget } from '@/components/superadmin/ClinicsMapWidget';

// ─── Paleta ────────────────────────────────────────────────────────────────
const COLORS = {
  active:    '#10b981',
  trial:     '#f59e0b',
  overdue:   '#ef4444',
  none:      '#6b7280',
  odonto:    '#3b82f6',
  medico:    '#8b5cf6',
  estetica:  '#ec4899',
  outro:     '#64748b',
};

// ─── Tooltip customizado ────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color ?? entry.fill }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut tooltip ──────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.payload.fill }} />
        <span className="font-medium">{d.name}</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-bold">{d.value}</span>
      </div>
    </div>
  );
}

// ─── Derivar série de crescimento (últimos 6 meses) ─────────────────────────
function buildGrowthSeries(clinics: PlatformClinic[]) {
  const months: { label: string; date: Date; clinicas: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    months.push({ label: format(d, 'MMM/yy', { locale: ptBR }), date: d, clinicas: 0 });
  }
  clinics.forEach((c) => {
    const cd = startOfMonth(new Date(c.created_at));
    months.forEach((m) => {
      if (cd <= m.date) m.clinicas++;
    });
  });
  return months;
}

// ─── Derivar contagem por categoria ─────────────────────────────────────────
const CAT_LABEL: Record<string, string> = {
  odonto: 'Odonto', medico: 'Médica', estetica: 'Estética', outro: 'Outro',
};
function buildCategoryData(clinics: PlatformClinic[]) {
  const counts: Record<string, number> = { odonto: 0, medico: 0, estetica: 0, outro: 0 };
  clinics.forEach((c) => {
    const k = c.category ?? 'outro';
    counts[k] = (counts[k] ?? 0) + 1;
  });
  return Object.entries(counts)
    .map(([key, total]) => ({ key, cat: CAT_LABEL[key] ?? key, total, fill: (COLORS as any)[key] ?? COLORS.outro }))
    .filter((d) => d.total > 0);
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, gradient, loading }: {
  title: string; value: number | undefined;
  icon: React.ElementType; gradient: string; loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-md">
      <div className={`absolute inset-0 opacity-10 ${gradient}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-lg p-1.5 ${gradient} bg-opacity-20`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        {loading
          ? <div className="h-9 w-16 rounded bg-muted animate-pulse" />
          : <div className="text-3xl font-bold tracking-tight">{(value ?? 0).toLocaleString('pt-BR')}</div>}
      </CardContent>
    </Card>
  );
}

function SubBadge({ status }: { status: string | undefined }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Sem assinatura</Badge>;
  const map: Record<string, { label: string; className: string }> = {
    active:    { label: 'Ativo',        className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    trial:     { label: 'Trial',        className: 'bg-amber-100 text-amber-700 border-amber-300' },
    overdue:   { label: 'Inadimplente', className: 'bg-red-100 text-red-700 border-red-300' },
    cancelled: { label: 'Cancelado',    className: 'bg-gray-100 text-gray-500 border-gray-300' },
  };
  const cfg = map[status] ?? map.trial;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Donut central label ─────────────────────────────────────────────────────
function DonutLabel({ viewBox, total }: any) {
  const { cx, cy } = viewBox ?? {};
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-0.5em" fontSize="26" fontWeight="700" fill="currentColor">{total}</tspan>
      <tspan x={cx} dy="1.4em" fontSize="11" fill="#9ca3af">assinaturas</tspan>
    </text>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => fetchAdminData<PlatformStats>('stats'),
    retry: 1,
  });

  const { data: clinics = [], isLoading: loadingClinics } = useQuery({
    queryKey: ['platform-clinics'],
    queryFn: () => fetchAdminData<PlatformClinic[]>('clinics'),
    retry: 1,
  });

  const overdueItems = clinics.filter(c => c.subscription?.status === 'overdue');
  const nearDueItems = clinics.filter(c => {
    if (!c.subscription?.due_date) return false;
    const diff = (new Date(c.subscription.due_date).getTime() - Date.now()) / 86_400_000;
    return diff >= 0 && diff <= 7 && c.subscription.status !== 'overdue';
  });
  const recentClinics = [...clinics].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  // Dados para gráficos
  const growthData    = buildGrowthSeries(clinics);
  const categoryData  = buildCategoryData(clinics);

  const noSub = clinics.filter(c => !c.subscription).length;
  const donutData = [
    { name: 'Ativas',        value: stats?.active_subs  ?? 0, fill: COLORS.active  },
    { name: 'Trial',         value: stats?.trial_subs   ?? 0, fill: COLORS.trial   },
    { name: 'Inadimplentes', value: stats?.overdue_subs ?? 0, fill: COLORS.overdue },
    { name: 'Sem assinatura',value: noSub,                    fill: COLORS.none    },
  ].filter(d => d.value > 0);

  const totalSubs = donutData.reduce((s, d) => s + d.value, 0);

  const activePct = totalSubs > 0 ? Math.round(((stats?.active_subs ?? 0) / totalSubs) * 100) : 0;
  const radialData = [
    { name: 'Taxa de ativação', value: activePct, fill: '#10b981' },
    { name: 'Profissionais/Clínica',
      value: clinics.length > 0 ? Math.min(100, Math.round(((stats?.total_doctors ?? 0) / clinics.length) * 10)) : 0,
      fill: '#8b5cf6' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral da Plataforma</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Apenas dados agregados — nenhum dado de paciente ou prontuário é exibido aqui.
        </p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="Clínicas cadastradas"   value={stats?.total_clinics}  icon={Building2}     gradient="bg-gradient-to-br from-blue-500 to-blue-700"    loading={loadingStats} />
        <StatCard title="Profissionais de saúde"  value={stats?.total_doctors}  icon={Stethoscope}   gradient="bg-gradient-to-br from-violet-500 to-violet-700"  loading={loadingStats} />
        <StatCard title="Pacientes na plataforma" value={stats?.total_patients} icon={Users}         gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"   loading={loadingStats} />
        <StatCard title="Assinaturas ativas"      value={stats?.active_subs}    icon={CheckCircle}   gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" loading={loadingStats} />
        <StatCard title="Em período trial"        value={stats?.trial_subs}     icon={Clock}         gradient="bg-gradient-to-br from-amber-500 to-amber-600"     loading={loadingStats} />
        <StatCard title="Inadimplentes"           value={stats?.overdue_subs}   icon={AlertTriangle} gradient="bg-gradient-to-br from-red-500 to-red-700"         loading={loadingStats} />
      </div>

      {/* ── Mapa geográfico ──────────────────────────────────────────────── */}
      {!loadingClinics && clinics.length > 0 && (
        <ClinicsMapWidget clinics={clinics} />
      )}

      {/* ── Gráficos linha 1: Crescimento + Donut ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Area chart — crescimento acumulado */}
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-base">Crescimento da Plataforma</CardTitle>
            </div>
            <CardDescription>Clínicas acumuladas nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClinics ? (
              <div className="h-52 rounded-lg bg-muted animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={growthData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradClinicas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="clinicas"
                    name="Clínicas"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#gradClinicas)"
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut — status das assinaturas */}
        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status das Assinaturas</CardTitle>
            <CardDescription>Distribuição atual</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats || loadingClinics ? (
              <div className="h-52 rounded-lg bg-muted animate-pulse" />
            ) : totalSubs === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={900}
                    labelLine={false}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} stroke="transparent" />
                    ))}
                    <DonutLabel total={totalSubs} />
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos linha 2: Por categoria + Radial ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar chart — clínicas por categoria */}
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clínicas por Tipo</CardTitle>
            <CardDescription>Clique em uma barra para ver as clínicas daquele tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingClinics ? (
              <div className="h-52 rounded-lg bg-muted animate-pulse" />
            ) : categoryData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart
                  data={categoryData}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                  barSize={36}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    if (e?.activePayload?.[0]?.payload?.key) {
                      navigate(`/superadmin/clinicas?categoria=${e.activePayload[0].payload.key}`);
                    }
                  }}
                >
                  <defs>
                    {categoryData.map((d, i) => (
                      <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={d.fill} stopOpacity={1} />
                        <stop offset="100%" stopColor={d.fill} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                  <XAxis dataKey="cat" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'currentColor', opacity: 0.04 }} />
                  <Bar dataKey="total" name="Clínicas" radius={[6, 6, 0, 0]} animationDuration={900}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={`url(#grad-${i})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Radial — métricas de saúde */}
        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Métricas de Saúde</CardTitle>
            <CardDescription>Indicadores da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats || loadingClinics ? (
              <div className="h-52 rounded-lg bg-muted animate-pulse" />
            ) : (
              <div className="space-y-1">
                <ResponsiveContainer width="100%" height={160}>
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={72}
                    barSize={14}
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      background={{ fill: 'currentColor', opacity: 0.05 }}
                      dataKey="value"
                      cornerRadius={8}
                      animationDuration={1000}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="space-y-2 pt-1">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Alertas ──────────────────────────────────────────────────────── */}
      {(overdueItems.length > 0 || nearDueItems.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de Pagamento
          </h2>
          <div className="rounded-lg border divide-y overflow-hidden">
            {overdueItems.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/20">
                <span className="font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.subscription?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Venceu {format(new Date(c.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                  <Badge variant="destructive">Inadimplente</Badge>
                </div>
              </div>
            ))}
            {nearDueItems.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/20">
                <span className="font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  {c.subscription?.due_date && (
                    <span className="text-xs text-muted-foreground">
                      Vence {format(new Date(c.subscription.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                  )}
                  <Badge variant="outline" className="border-amber-500 text-amber-600">Vence em breve</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Últimas clínicas ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Últimas clínicas cadastradas</h2>
        {loadingClinics ? (
          <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : recentClinics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma clínica cadastrada ainda.</p>
        ) : (
          <div className="rounded-lg border divide-y overflow-hidden">
            {recentClinics.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: (COLORS as any)[c.category] ?? COLORS.outro }}
                  >
                    {(c.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-sm">{c.name}</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="capitalize">{CAT_LABEL[c.category] ?? c.category}</span>
                      {c.city && <><span>·</span><span>{c.city}{c.state ? `/${c.state}` : ''}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{c.member_count} membro{c.member_count !== 1 ? 's' : ''}</span>
                  <SubBadge status={c.subscription?.status} />
                  <span>{format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Nota de privacidade ───────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
        <span>
          Dados de pacientes (nome, CPF, prontuários, consultas){' '}
          <strong>não são acessíveis</strong> neste painel.
        </span>
      </div>
    </div>
  );
}
