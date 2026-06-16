import {
  Calendar,
  Users,
  DollarSign,
  AlertTriangle,
  Plus,
  UserPlus,
  CreditCard,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMemo } from "react";
import { AnimatedNumber } from "@/components/dashboard/AnimatedNumber";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import DentistHome from "@/pages/dentist/DentistHome";
import MedicalHome from "@/pages/medical/MedicalHome";
import NutritionHome from "@/pages/nutrition/NutritionHome";
import PsiHome from "@/pages/psi/PsiHome";
import { useSpecialtyProfile } from "@/hooks/useSpecialtyProfile";
import { SoloModeBanner } from "@/components/dashboard/SoloModeBanner";

export default function IndexRouter() {
  const { effectiveRole } = useRoleAccess();
  if (effectiveRole === "dentist") return <DentistRouter />;
  return <AdminHome />;
}

function DentistRouter() {
  const { profile } = useSpecialtyProfile();
  switch (profile.family) {
    case "medical":
    case "aesthetic":
      return <MedicalHome />;
    case "nutrition":
      return <NutritionHome />;
    case "psi":
      return <PsiHome />;
    case "odonto":
    case "physio":
    case "podology":
    case "generic":
    default:
      return <DentistHome />;
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const ADM_STATUS_COLORS: Record<string, string> = {
  scheduled: '#6366f1', confirmed: '#10b981', completed: '#3b82f6',
  in_progress: '#f59e0b', no_show: '#ef4444', cancelled: '#94a3b8',
};
const ADM_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída',
  in_progress: 'Em atend.', no_show: 'Faltou', cancelled: 'Cancelada',
};

function AdminChartTooltip({ active, payload, label }: any) {
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

function AdminHome() {
  const { profile, currentClinicId } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "Doutor(a)";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: todayCount = 0 } = useQuery({
    queryKey: ["kpi-today-count", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("appointments").select("id", { count: "exact", head: true })
        .gte("start_time", todayStart).lt("start_time", todayEnd);
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: patientCount = 0 } = useQuery({
    queryKey: ["kpi-patient-count", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("patients").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: monthlyRevenue = 0 } = useQuery({
    queryKey: ["kpi-monthly-revenue", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("amount").eq("type", "income").eq("status", "paid")
        .gte("paid_date", monthStart.slice(0, 10)).lte("paid_date", monthEnd.slice(0, 10));
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;
    },
  });

  const { data: noShowRate = 0 } = useQuery({
    queryKey: ["kpi-noshow", currentClinicId],
    queryFn: async () => {
      let q1 = supabase.from("appointments").select("id", { count: "exact", head: true })
        .gte("start_time", monthStart).lte("start_time", monthEnd);
      let q2 = supabase.from("appointments").select("id", { count: "exact", head: true })
        .gte("start_time", monthStart).lte("start_time", monthEnd).eq("status", "no_show");
      if (currentClinicId) { q1 = q1.eq("clinic_id", currentClinicId); q2 = q2.eq("clinic_id", currentClinicId); }
      const { count: total } = await q1;
      const { count: noShow } = await q2;
      if (!total || total === 0) return 0;
      return Math.round(((noShow ?? 0) / total) * 100);
    },
  });

  // 6-month appointment trend (also used for donut)
  const { data: sixMonthApts = [] } = useQuery({
    queryKey: ["adm-6m-apts", currentClinicId],
    queryFn: async () => {
      const sixAgo = startOfMonth(subMonths(now, 5));
      let q = supabase.from("appointments").select("start_time, status")
        .gte("start_time", sixAgo.toISOString()).lte("start_time", endOfMonth(now).toISOString());
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const sixMonthData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i);
      return { label: format(d, "MMM/yy", { locale: ptBR }), total: 0, concluidas: 0 };
    });
    (sixMonthApts as any[]).forEach((a) => {
      const lbl = format(parseISO(a.start_time), "MMM/yy", { locale: ptBR });
      const entry = months.find(m => m.label === lbl);
      if (entry) { entry.total++; if (a.status === "completed") entry.concluidas++; }
    });
    return months;
  }, [sixMonthApts]);

  const statusChartData = useMemo(() => {
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const counts: Record<string, number> = {};
    (sixMonthApts as any[])
      .filter(a => { const d = parseISO(a.start_time); return d >= mStart && d <= mEnd; })
      .forEach(a => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts)
      .map(([s, v]) => ({ name: ADM_STATUS_LABELS[s] ?? s, value: v, fill: ADM_STATUS_COLORS[s] ?? '#94a3b8' }))
      .filter(d => d.value > 0);
  }, [sixMonthApts]);

  const totalMonthApts = useMemo(() => {
    const mStart = startOfMonth(now); const mEnd = endOfMonth(now);
    return (sixMonthApts as any[]).filter(a => { const d = parseISO(a.start_time); return d >= mStart && d <= mEnd; }).length;
  }, [sixMonthApts]);

  const completedMonthApts = useMemo(() => {
    const mStart = startOfMonth(now); const mEnd = endOfMonth(now);
    return (sixMonthApts as any[]).filter(a => { const d = parseISO(a.start_time); return d >= mStart && d <= mEnd && a.status === "completed"; }).length;
  }, [sixMonthApts]);

  const completionRate = totalMonthApts > 0 ? Math.round((completedMonthApts / totalMonthApts) * 100) : 0;

  // Revenue chart (last 6 months)
  const sixMonthsAgo = subMonths(now, 5);
  const { data: revenueTxs = [] } = useQuery({
    queryKey: ["revenue-chart-6m", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("amount, paid_date, type").eq("status", "paid")
        .gte("paid_date", format(startOfMonth(sixMonthsAgo), "yyyy-MM-dd"))
        .lte("paid_date", format(endOfMonth(now), "yyyy-MM-dd"));
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const revenueChartData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      months[format(m, "MMM", { locale: ptBR })] = { income: 0, expense: 0 };
    }
    revenueTxs.forEach((tx: any) => {
      if (!tx.paid_date) return;
      const key = format(parseISO(tx.paid_date), "MMM", { locale: ptBR });
      if (months[key]) {
        if (tx.type === "income") months[key].income += Number(tx.amount);
        else months[key].expense += Number(tx.amount);
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [revenueTxs]);

  // Weekly appointments
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: weekApts = [] } = useQuery({
    queryKey: ["week-chart", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("appointments").select("start_time")
        .gte("start_time", weekStart.toISOString()).lte("start_time", weekEnd.toISOString());
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const weekData = weekDays.map((day) => ({
    day: format(day, "EEE", { locale: ptBR }),
    count: weekApts.filter((a) => isSameDay(parseISO(a.start_time), day)).length,
  }));
  const maxWeek = Math.max(...weekData.map((d) => d.count), 1);

  // Upcoming + Pending
  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-appointments", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("appointments").select("*, patients(full_name), procedures(name, color)")
        .gte("start_time", now.toISOString()).order("start_time").limit(5);
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: pendingPayments = [] } = useQuery({
    queryKey: ["pending-payments", currentClinicId],
    queryFn: async () => {
      let q = supabase.from("financial_transactions").select("*, patients(full_name)")
        .eq("status", "pending").eq("type", "income").order("due_date").limit(5);
      if (currentClinicId) q = q.eq("clinic_id", currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const kpiCards = [
    { title: "Consultas Hoje", value: todayCount, description: "agendadas para hoje", icon: Calendar, gradient: "bg-gradient-to-br from-indigo-500 to-indigo-700" },
    { title: "Pacientes Ativos", value: patientCount, description: "cadastrados", icon: Users, gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700" },
    { title: "Receita do Mês", value: monthlyRevenue, description: "recebido este mês", icon: DollarSign, gradient: "bg-gradient-to-br from-amber-500 to-amber-600", isCurrency: true },
    { title: "Taxa No-Show", value: noShowRate, description: "faltas no mês", icon: AlertTriangle, gradient: "bg-gradient-to-br from-rose-500 to-rose-700", isPercentage: true },
  ];

  const statusBadgeColors: Record<string, string> = {
    scheduled: "bg-primary/10 text-primary", confirmed: "bg-success/10 text-success",
    in_progress: "bg-amber-500/10 text-amber-600", completed: "bg-success/10 text-success",
    no_show: "bg-destructive/10 text-destructive", cancelled: "bg-muted text-muted-foreground",
  };
  const statusBadgeLabels: Record<string, string> = {
    scheduled: "Agendada", confirmed: "Confirmada", in_progress: "Em atendimento",
    completed: "Concluída", no_show: "Faltou", cancelled: "Cancelada",
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        description="Seja bem-vindo(a)! Aqui está o resumo da sua clínica hoje."
      />
      <SoloModeBanner />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card
            key={kpi.title}
            className="relative overflow-hidden border-0 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ animationDelay: `${i * 60}ms`, animation: "slide-up 0.4s ease-out backwards" }}
          >
            <div className={`absolute inset-0 opacity-10 ${kpi.gradient}`} />
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`rounded-lg p-1.5 ${kpi.gradient}`}>
                <kpi.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <AnimatedNumber
                value={kpi.value}
                className="text-2xl font-bold tracking-tight"
                formatter={kpi.isCurrency ? fmt : kpi.isPercentage ? (v) => `${Math.round(v)}%` : undefined}
              />
              <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1: Appointment trend + Status donut */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-md border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-base">Tendência de Consultas</CardTitle>
            </div>
            <CardDescription>Últimos 6 meses · total vs concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sixMonthData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="adm-gradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="adm-gradConc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<AdminChartTooltip />} />
                <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} fill="url(#adm-gradTotal)" dot={false} />
                <Area type="monotone" dataKey="concluidas" name="Concluídas" stroke="#10b981" strokeWidth={2} fill="url(#adm-gradConc)" dot={false} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status do Mês</CardTitle>
            <CardDescription>{completionRate}% de conclusão · {totalMonthApts} consultas</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Sem consultas este mês
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="44%" innerRadius={52} outerRadius={74}
                    paddingAngle={3} dataKey="value" animationDuration={800} labelLine={false}>
                    {statusChartData.map((e, i) => <Cell key={i} fill={e.fill} stroke="transparent" />)}
                    <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle">
                      <tspan fontSize="22" fontWeight="700" fill="currentColor">{completionRate}%</tspan>
                    </text>
                  </Pie>
                  <Tooltip content={<AdminChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Revenue + Weekly */}
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
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
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
                  <div className="w-full rounded-t-md bg-gradient-to-t from-primary/30 to-primary/10 transition-all hover:from-primary/40 hover:to-primary/20"
                    style={{ height: `${Math.max((d.count / maxWeek) * 100, 4)}%` }} />
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
                      <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), "HH:mm")}
                    </div>
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: (apt as any).procedures?.color ?? "hsl(var(--primary))" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? "Consulta"}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] rounded-full ${statusBadgeColors[apt.status] ?? ""}`}>
                      {statusBadgeLabels[apt.status] ?? apt.status}
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
                      <p className="text-xs text-muted-foreground">Venc: {format(parseISO(tx.due_date), "dd/MM/yyyy")}</p>
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
            { label: "Nova Consulta", icon: Plus, href: "/agenda" },
            { label: "Novo Paciente", icon: UserPlus, href: "/patients" },
            { label: "Registrar Pagamento", icon: CreditCard, href: "/financial" },
          ].map((action) => (
            <Button key={action.label} variant="outline"
              className="gap-2 border-border/50 hover:bg-accent shadow-card hover:shadow-card-hover transition-all" asChild>
              <Link to={action.href}><action.icon className="h-4 w-4" />{action.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
