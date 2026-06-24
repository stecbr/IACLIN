import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, Users, ClipboardList, Clock, ArrowRight, Eye, FolderHeart,
  DollarSign, Wallet, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { getFamilyConfig } from '@/lib/specialtyFamily';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';
import { SoloModeBanner } from '@/components/dashboard/SoloModeBanner';
import { specialtyLabel } from '@/components/SpecialtySelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-sm shadow-xl px-4 py-3 text-sm">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((e: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.stroke ?? e.fill }} />
          <span className="text-muted-foreground">{e.name}:</span>
          <span className="font-medium">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1', confirmed: '#10b981', completed: '#3b82f6',
  in_progress: '#f59e0b', no_show: '#ef4444', cancelled: '#94a3b8',
};
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída',
  in_progress: 'Em atend.', no_show: 'Faltou', cancelled: 'Cancelada',
};

export default function DentistHome() {
  const { user, profile, currentClinicId } = useAuth();
  const [summaryAptId, setSummaryAptId] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const navigate = useNavigate();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';

  const { data: memberSpecialty } = useQuery({
    queryKey: ['dentist-home-specialty', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinic_members')
        .select('specialty').eq('user_id', user!.id).eq('clinic_id', currentClinicId!).maybeSingle();
      return data?.specialty ?? null;
    },
  });
  const family = getFamilyConfig(memberSpecialty);
  const specialtyName = specialtyLabel(memberSpecialty);
  const apptCap = family.appointmentNoun.charAt(0).toUpperCase() + family.appointmentNoun.slice(1);
  const apptCapPlural = family.appointmentNounPlural.charAt(0).toUpperCase() + family.appointmentNounPlural.slice(1);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: isClinicOwner = false } = useQuery({
    queryKey: ['dentist-is-clinic-owner', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinics')
        .select('owner_id').eq('id', currentClinicId!).maybeSingle();
      return data?.owner_id === user!.id;
    },
  });

  const { data: todayApts = [] } = useQuery({
    queryKey: ['dentist-today', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', todayStart).lt('start_time', todayEnd)
        .eq('dentist_id', user.id).order('start_time');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: monthApts = [] } = useQuery({
    queryKey: ['dentist-month', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from('appointments')
        .select('id, status, patient_id')
        .gte('start_time', monthStart).lte('start_time', monthEnd)
        .eq('dentist_id', user.id);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  // 6-month trend data
  const { data: sixMonthApts = [] } = useQuery({
    queryKey: ['dentist-6m', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      const sixAgo = startOfMonth(subMonths(now, 5));
      let q = supabase.from('appointments')
        .select('start_time, status')
        .eq('dentist_id', user.id)
        .gte('start_time', sixAgo.toISOString())
        .lte('start_time', endOfMonth(now).toISOString());
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  const kpis = useMemo(() => {
    const total = monthApts.length;
    const noShow = monthApts.filter((a: any) => a.status === 'no_show').length;
    const completed = monthApts.filter((a: any) => a.status === 'completed').length;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
    const uniquePatients = new Set(monthApts.map((a: any) => a.patient_id)).size;
    return { total, noShowRate, completed, uniquePatients };
  }, [monthApts]);

  const completedToday = useMemo(
    () => (todayApts as any[]).filter(a => a.status === 'completed').length,
    [todayApts]
  );

  const { data: financialMonth } = useQuery({
    queryKey: ['dentist-financial-month', user?.id, currentClinicId, monthStart, monthEnd],
    enabled: !!user?.id && !!currentClinicId && isClinicOwner,
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('amount, status, type, due_date, paid_date')
        .eq('clinic_id', currentClinicId!).eq('dentist_id', user!.id).eq('type', 'income');
      const rows = (data ?? []) as any[];
      const ms = startOfMonth(now), me = endOfMonth(now);
      const inMonth = (d?: string | null) => { if (!d) return false; const dt = parseISO(d); return dt >= ms && dt <= me; };
      return {
        received: rows.filter(r => r.status === 'paid' && inMonth(r.paid_date ?? r.due_date)).reduce((s, r) => s + Number(r.amount ?? 0), 0),
        toReceive: rows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount ?? 0), 0),
      };
    },
  });

  const { data: openPlans = 0 } = useQuery({
    queryKey: ['dentist-open-plans', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from('treatment_plans')
        .select('id', { count: 'exact', head: true }).eq('dentist_id', user.id)
        .in('status', ['pending', 'negotiating']);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ['dentist-upcoming', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', now.toISOString()).eq('dentist_id', user.id)
        .order('start_time').limit(5);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Chart data
  const sixMonthData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return { label: format(d, 'MMM/yy', { locale: ptBR }), total: 0, concluidas: 0 };
    });
    (sixMonthApts as any[]).forEach((a) => {
      const lbl = format(parseISO(a.start_time), 'MMM/yy', { locale: ptBR });
      const entry = months.find(m => m.label === lbl);
      if (entry) { entry.total++; if (a.status === 'completed') entry.concluidas++; }
    });
    return months;
  }, [sixMonthApts]);

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    (monthApts as any[]).forEach((a) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([s, v]) => ({ name: STATUS_LABELS[s] ?? s, value: v, fill: STATUS_COLORS[s] ?? '#94a3b8' }))
      .filter(d => d.value > 0);
  }, [monthApts]);

  const completionRate = kpis.total > 0 ? Math.round((kpis.completed / kpis.total) * 100) : 0;

  const statusColors: Record<string, string> = {
    scheduled: 'bg-primary/10 text-primary',
    confirmed: 'bg-success/10 text-success',
    completed: 'bg-success/10 text-success',
    no_show: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
  };
  const statusLabels: Record<string, string> = {
    scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída',
    no_show: 'Faltou', cancelled: 'Cancelada',
  };

  const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const baseKpis = [
    { title: `${apptCapPlural} Hoje`, value: todayApts.length, desc: 'na sua agenda', icon: Calendar, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
    { title: `${apptCapPlural} Concluídos Hoje`, value: completedToday, desc: `de ${todayApts.length} agendados`, icon: CheckCircle2, gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700', click: () => setSessionsOpen(true) },
    { title: `${apptCapPlural} no Mês`, value: kpis.completed, desc: `de ${kpis.total} agendados`, icon: family.icon, gradient: 'bg-gradient-to-br from-blue-500 to-blue-700' },
    { title: 'Pacientes Únicos', value: kpis.uniquePatients, desc: 'atendidos este mês', icon: Users, gradient: 'bg-gradient-to-br from-violet-500 to-violet-700' },
    // Só exibe "Planos Abertos" quando a família profissional usa orçamentos
    // (odonto / estética). Médicos, fisios, podólogos etc. não veem este card.
    ...(family.showBudgets
      ? [{ title: 'Planos Abertos', value: openPlans, desc: 'aguardando decisão', icon: ClipboardList, gradient: 'bg-gradient-to-br from-amber-500 to-amber-600' }]
      : []),
  ] as any[];

  const ownerKpis = isClinicOwner ? [
    { title: 'Faturado no Mês', value: financialMonth?.received ?? 0, desc: 'recebido este mês', icon: DollarSign, gradient: 'bg-gradient-to-br from-emerald-600 to-teal-700', currency: true },
    { title: 'A Receber', value: financialMonth?.toReceive ?? 0, desc: 'pendente', icon: Wallet, gradient: 'bg-gradient-to-br from-orange-500 to-orange-700', currency: true },
  ] : [];

  const kpiCards = [...baseKpis, ...ownerKpis];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getGreeting()}, Dr(a). ${firstName}`}
        description={`Seja bem-vindo(a)${specialtyName ? ` · ${specialtyName}` : ''} — Aqui está o resumo do seu dia.`}
      >
        <ViewModeToggle />
      </PageHeader>
      <SoloModeBanner />

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className={`grid gap-4 sm:grid-cols-2 ${isClinicOwner ? 'lg:grid-cols-3 xl:grid-cols-7' : `lg:grid-cols-${baseKpis.length}`}`}>
        {kpiCards.map((kpi, i) => (
          <Card
            key={kpi.title}
            onClick={kpi.click}
            role={kpi.click ? 'button' : undefined}
            tabIndex={kpi.click ? 0 : undefined}
            onKeyDown={kpi.click ? (e: any) => { if (e.key === 'Enter') kpi.click(); } : undefined}
            className={`relative overflow-hidden border-0 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${kpi.click ? 'cursor-pointer' : ''}`}
            style={{ animationDelay: `${i * 60}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
          >
            <div className={`absolute inset-0 opacity-10 ${kpi.gradient}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`rounded-lg p-1.5 ${kpi.gradient}`}>
                <kpi.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <AnimatedNumber
                value={kpi.value}
                className="text-2xl font-bold tracking-tight"
                formatter={kpi.currency ? brl : undefined}
              />
              <p className="mt-1 text-xs text-muted-foreground">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Area chart — tendência 6 meses */}
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base">Tendência de {apptCapPlural}</CardTitle>
            </div>
            <CardDescription>Últimos 6 meses · total vs concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sixMonthData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="dh-gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dh-gradConc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} fill="url(#dh-gradTotal)" dot={false} />
                <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke="#10b981" strokeWidth={2} fill="url(#dh-gradConc)" dot={false} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut — status do mês */}
        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status do Mês</CardTitle>
            <CardDescription>
              {completionRate}% de conclusão · {kpis.total} {apptCapPlural.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Sem {apptCapPlural.toLowerCase()} este mês
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="44%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={800}
                    labelLine={false}
                  >
                    {statusChartData.map((e, i) => (
                      <Cell key={i} fill={e.fill} stroke="transparent" />
                    ))}
                    <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle">
                      <tspan fontSize="22" fontWeight="700" fill="currentColor">{completionRate}%</tspan>
                    </text>
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Agenda de hoje ──────────────────────────────────────────── */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sua Agenda de Hoje</CardTitle>
            <Link to="/agenda" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todayApts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{`Nenhuma ${family.appointmentNoun} agendada para hoje`}</p>
          ) : (
            <div className="space-y-1">
              {(todayApts as any[]).map((apt) => (
                <div key={apt.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                    <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: apt.procedures?.color ?? 'hsl(var(--primary))' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? apptCap}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] rounded-full ${statusColors[apt.status] ?? ''}`}>
                    {statusLabels[apt.status] ?? apt.status}
                  </Badge>
                  <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1 text-muted-foreground hover:text-primary" title="Prontuário">
                    <Link to={`/patients/${apt.patient_id}`}><FolderHeart className="h-3 w-3" /> Prontuário</Link>
                  </Button>
                  {apt.status === 'completed' ? (
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1" onClick={() => setSummaryAptId(apt.id)}>
                      <Eye className="h-3 w-3" /> Ver resumo
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs">
                      <Link to={`/atendimento/${apt.id}`}>Atender</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Próximas consultas ──────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximas {apptCapPlural}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(upcoming as any[]).map((apt) => (
                <div
                  key={apt.id}
                  className={`flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 ${apt.status === 'completed' ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}
                  onClick={apt.status === 'completed' ? () => setSummaryAptId(apt.id) : undefined}
                >
                  <div className="text-xs text-muted-foreground min-w-[120px]">
                    {format(parseISO(apt.start_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? apptCap}</p>
                  </div>
                  {apt.status === 'completed' && <Eye className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AttendanceSummaryModal
        appointmentId={summaryAptId}
        open={!!summaryAptId}
        onOpenChange={(o) => { if (!o) setSummaryAptId(null); }}
      />

      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{apptCapPlural} concluídos hoje</DialogTitle></DialogHeader>
          {todayApts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma sessão hoje</p>
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {(todayApts as any[]).map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => { setSessionsOpen(false); navigate(`/patients/${apt.patient_id}`); }}
                  className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                    <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                  </div>
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: apt.procedures?.color ?? 'hsl(var(--primary))' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? apptCap}</p>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] rounded-full ${statusColors[apt.status] ?? ''}`}>
                    {statusLabels[apt.status] ?? apt.status}
                  </Badge>
                  <FolderHeart className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
