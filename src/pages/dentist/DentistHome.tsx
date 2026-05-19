import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Users, ClipboardList, Clock, ArrowRight, Stethoscope, Eye, FolderHeart, DollarSign, Wallet, CheckCircle2 } from 'lucide-react';
import { getFamilyConfig } from '@/lib/specialtyFamily';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { AnimatedNumber } from '@/components/dashboard/AnimatedNumber';
import { AttendanceSummaryModal } from '@/components/attendance/AttendanceSummaryModal';
import { SoloModeBanner } from '@/components/dashboard/SoloModeBanner';
import { specialtyLabel } from '@/components/SpecialtySelect';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DentistHome() {
  const { user, profile, currentClinicId } = useAuth();
  const [summaryAptId, setSummaryAptId] = useState<string | null>(null);
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Doutor(a)';

  // Doctor's specialty family — drives terminology in this dashboard
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

  // Is the logged-in dentist the owner of the currently selected clinic?
  const { data: isClinicOwner = false } = useQuery({
    queryKey: ['dentist-is-clinic-owner', user?.id, currentClinicId],
    enabled: !!user?.id && !!currentClinicId,
    queryFn: async () => {
      const { data } = await supabase.from('clinics')
        .select('owner_id').eq('id', currentClinicId!).maybeSingle();
      return data?.owner_id === user!.id;
    },
  });

  // Today's appointments (mine)
  const { data: todayApts = [] } = useQuery({
    queryKey: ['dentist-today', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', todayStart).lt('start_time', todayEnd)
        .eq('dentist_id', user.id)
        .order('start_time');
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Month KPIs
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

  // Financial KPIs — only when the dentist owns the current clinic
  const { data: financialMonth } = useQuery({
    queryKey: ['dentist-financial-month', user?.id, currentClinicId, monthStart, monthEnd],
    enabled: !!user?.id && !!currentClinicId && isClinicOwner,
    queryFn: async () => {
      const { data } = await supabase.from('financial_transactions')
        .select('amount, status, type, due_date, paid_date')
        .eq('clinic_id', currentClinicId!)
        .eq('dentist_id', user!.id)
        .eq('type', 'income');
      const rows = (data ?? []) as any[];
      const monthStartDate = startOfMonth(now);
      const monthEndDate = endOfMonth(now);
      const inMonth = (d?: string | null) => {
        if (!d) return false;
        const dt = parseISO(d);
        return dt >= monthStartDate && dt <= monthEndDate;
      };
      const received = rows
        .filter(r => r.status === 'paid' && inMonth(r.paid_date ?? r.due_date))
        .reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const toReceive = rows
        .filter(r => r.status === 'pending')
        .reduce((s, r) => s + Number(r.amount ?? 0), 0);
      return { received, toReceive };
    },
  });

  // Open treatment plans (mine)
  const { data: openPlans = 0 } = useQuery({
    queryKey: ['dentist-open-plans', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from('treatment_plans')
        .select('id', { count: 'exact', head: true })
        .eq('dentist_id', user.id)
        .in('status', ['pending', 'negotiating']);
      return count ?? 0;
    },
    enabled: !!user,
  });

  // Upcoming next 5
  const { data: upcoming = [] } = useQuery({
    queryKey: ['dentist-upcoming', user?.id, currentClinicId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase.from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', now.toISOString())
        .eq('dentist_id', user.id)
        .order('start_time').limit(5);
      if (currentClinicId) q = q.eq('clinic_id', currentClinicId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
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

  const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const baseKpis = [
    { title: `${apptCapPlural} Hoje`, value: todayApts.length, desc: 'na sua agenda', icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Sessões de Hoje', value: completedToday, desc: `de ${todayApts.length} agendadas`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: `${apptCapPlural} no Mês`, value: kpis.completed, desc: `de ${kpis.total} agendados`, icon: family.icon, color: 'text-success', bg: 'bg-success/10' },
    { title: 'Pacientes Únicos', value: kpis.uniquePatients, desc: 'atendidos este mês', icon: Users, color: 'text-warning', bg: 'bg-warning/10' },
    { title: 'Planos Abertos', value: openPlans, desc: 'aguardando decisão', icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ] as any[];

  const ownerKpis = isClinicOwner
    ? [
        { title: 'Faturado no Mês', value: financialMonth?.received ?? 0, desc: 'recebido este mês', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-500/10', currency: true },
        { title: 'A Receber', value: financialMonth?.toReceive ?? 0, desc: 'pendente de pagamento', icon: Wallet, color: 'text-amber-500', bg: 'bg-amber-500/10', currency: true },
      ]
    : [];

  const kpiCards = [...baseKpis, ...ownerKpis];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${getGreeting()}, Dr(a). ${firstName} 👋`}
        description={`Seja bem-vindo(a)${specialtyName ? ` · ${specialtyName}` : ''} — Aqui está o resumo do seu dia.`}
      />
      <SoloModeBanner />

      {/* KPIs */}
      <div className={`grid gap-4 sm:grid-cols-2 ${isClinicOwner ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-4'}`}>
        {kpiCards.map((kpi, i) => (
          <Card
            key={kpi.title}
            className="group relative overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border-border/50 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 80}ms`, animation: 'slide-up 0.4s ease-out backwards' }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`h-9 w-9 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <AnimatedNumber
                value={kpi.value}
                className="text-2xl font-semibold text-foreground"
                formatter={kpi.currency ? brl : undefined}
              />
              <p className="mt-1 text-xs text-muted-foreground">{kpi.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="grid gap-6">
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
              <p className="text-sm text-muted-foreground py-8 text-center">{`Nenhuma ${family.appointmentNoun} agendada para hoje 🎉`}</p>
            ) : (
              <div className="space-y-1">
                {todayApts.map((apt: any) => (
                  <div key={apt.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors group">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[64px]">
                      <Clock className="h-3 w-3" />{format(parseISO(apt.start_time), 'HH:mm')}
                    </div>
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: apt.procedures?.color ?? 'hsl(var(--primary))' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{apt.patients?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? apptCap}</p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] rounded-full ${statusColors[apt.status] ?? ''}`}>
                      {statusLabels[apt.status] ?? apt.status}
                    </Badge>
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1 text-muted-foreground hover:text-primary"
                      title="Abrir prontuário"
                    >
                      <Link to={`/patients/${apt.patient_id}`}>
                        <FolderHeart className="h-3 w-3" /> Prontuário
                      </Link>
                    </Button>
                    {apt.status === 'completed' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-7 text-xs gap-1"
                        onClick={() => setSummaryAptId(apt.id)}
                      >
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
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximas Consultas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {upcoming.map((apt: any) => (
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
                    <p className="text-xs text-muted-foreground truncate">{apt.procedures?.name ?? 'Consulta'}</p>
                  </div>
                  {apt.status === 'completed' && (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
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
    </div>
  );
}
