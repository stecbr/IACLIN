import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Stethoscope,
  Building2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  isToday,
  isThisWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

type View = 'day' | 'week' | 'list';

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  completed: { label: 'Concluída', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: XCircle },
  no_show: { label: 'Faltou', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertCircle },
};

export default function OperatorAgenda() {
  const { operatorId } = useAuth();
  const [tab, setTab] = useState<'consultas' | 'disponibilidade'>('consultas');
  const [view, setView] = useState<View>('week');
  const [refDate, setRefDate] = useState(new Date());
  const [clinicFilter, setClinicFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Credenciamentos aprovados desta operadora
  const { data: creds = [] } = useQuery({
    queryKey: ['op-creds', operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data } = await supabase
        .from('operator_credentialings')
        .select('clinic_id, professional_user_id, clinics(id, name), profiles:professional_user_id(id, full_name)')
        .eq('operator_id', operatorId!)
        .eq('status', 'approved');
      return (data ?? []) as any[];
    },
  });

  const clinics = useMemo(() => {
    const m = new Map<string, string>();
    creds.forEach((c: any) => c.clinics && m.set(c.clinics.id, c.clinics.name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [creds]);

  const doctors = useMemo(() => {
    const m = new Map<string, string>();
    creds.forEach((c: any) => c.profiles && m.set(c.profiles.id, c.profiles.full_name));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [creds]);

  // Range de datas conforme view
  const range = useMemo(() => {
    if (view === 'day') return { start: startOfDay(refDate), end: endOfDay(refDate) };
    if (view === 'week') {
      return {
        start: startOfWeek(refDate, { weekStartsOn: 1 }),
        end: endOfWeek(refDate, { weekStartsOn: 1 }),
      };
    }
    // list: próximos 30 dias
    return { start: startOfDay(refDate), end: endOfDay(addDays(refDate, 30)) };
  }, [view, refDate]);

  // Consultas dos beneficiários nas clínicas/profissionais credenciados
  const { data: appointments = [], isLoading: loadingApts } = useQuery({
    queryKey: ['op-appointments', operatorId, range.start.toISOString(), range.end.toISOString()],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, presence_status, clinic_id, dentist_id, notes, patients(full_name, cpf, phone), procedures(name, color), clinics(name)')
        .gte('start_time', range.start.toISOString())
        .lte('start_time', range.end.toISOString())
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Profiles dos dentistas (para mostrar nome)
  const dentistIds = useMemo(
    () => Array.from(new Set(appointments.map((a: any) => a.dentist_id).filter(Boolean))),
    [appointments]
  );
  const { data: dentistProfiles = [] } = useQuery({
    queryKey: ['op-apt-dentists', dentistIds.join(',')],
    enabled: dentistIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', dentistIds);
      return (data ?? []) as any[];
    },
  });
  const dentistMap = useMemo(() => {
    const m = new Map<string, string>();
    dentistProfiles.forEach((p: any) => m.set(p.id, p.full_name));
    doctors.forEach((d) => !m.has(d.id) && m.set(d.id, d.name));
    return m;
  }, [dentistProfiles, doctors]);

  // Filtros aplicados em memória
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a: any) => {
      if (clinicFilter !== 'all' && a.clinic_id !== clinicFilter) return false;
      if (doctorFilter !== 'all' && a.dentist_id !== doctorFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q) {
        const hay = `${a.patients?.full_name ?? ''} ${a.patients?.cpf ?? ''} ${a.procedures?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, clinicFilter, doctorFilter, statusFilter, search]);

  // KPIs (com base no resultado filtrado da janela carregada)
  const kpis = useMemo(() => {
    const today = filtered.filter((a: any) => isToday(parseISO(a.start_time)));
    const week = filtered.filter((a: any) => isThisWeek(parseISO(a.start_time), { weekStartsOn: 1 }));
    const confirmed = filtered.filter((a: any) => a.status === 'confirmed' || a.status === 'completed');
    const pending = filtered.filter((a: any) => a.status === 'scheduled');
    return { today: today.length, week: week.length, confirmed: confirmed.length, pending: pending.length };
  }, [filtered]);

  const navigate = (dir: 1 | -1) => {
    if (view === 'day') setRefDate(dir === 1 ? addDays(refDate, 1) : subDays(refDate, 1));
    else if (view === 'week') setRefDate(dir === 1 ? addWeeks(refDate, 1) : subWeeks(refDate, 1));
    else setRefDate(dir === 1 ? addDays(refDate, 30) : subDays(refDate, 30));
  };

  const headerLabel =
    view === 'day'
      ? format(refDate, "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })
      : view === 'week'
      ? `${format(range.start, 'dd MMM', { locale: ptBR })} — ${format(range.end, 'dd MMM yyyy', { locale: ptBR })}`
      : `Próximos 30 dias`;

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((a: any) => {
      const key = format(parseISO(a.start_time), 'yyyy-MM-dd');
      (map[key] ??= []).push(a);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Consultas dos seus beneficiários nas clínicas e profissionais credenciados.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Hoje" value={kpis.today} icon={CalendarIcon} tone="text-blue-600" />
        <KpiCard label="Esta semana" value={kpis.week} icon={CalendarDays} tone="text-violet-600" />
        <KpiCard label="Confirmadas" value={kpis.confirmed} icon={CheckCircle2} tone="text-emerald-600" />
        <KpiCard label="Pendentes" value={kpis.pending} icon={Clock} tone="text-amber-600" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="consultas">Consultas</TabsTrigger>
          <TabsTrigger value="disponibilidade">Disponibilidade</TabsTrigger>
        </TabsList>

        <TabsContent value="consultas" className="space-y-4">
          {/* Toolbar */}
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setRefDate(new Date())}>
                    Hoje
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => navigate(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="ml-2 text-sm font-medium capitalize">{headerLabel}</span>
                </div>
                <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(['day', 'week', 'list'] as View[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                        view === v
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Lista'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente, CPF ou procedimento"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>
                <Select value={clinicFilter} onValueChange={setClinicFilter}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Clínica" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as clínicas</SelectItem>
                    {clinics.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Profissional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os profissionais</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loadingApts ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyAppointments />
          ) : view === 'week' ? (
            <WeekGrid
              days={eachDayOfInterval({ start: range.start, end: range.end })}
              grouped={grouped}
              dentistMap={dentistMap}
              onDayClick={(d) => { setRefDate(d); setView('day'); }}
            />
          ) : (
            <ListView grouped={grouped} dentistMap={dentistMap} />
          )}
        </TabsContent>

        <TabsContent value="disponibilidade">
          <AvailabilityPanel operatorId={operatorId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyAppointments() {
  return (
    <Card className="rounded-xl p-12 text-center text-sm text-muted-foreground">
      <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      Nenhuma consulta encontrada no período selecionado.
    </Card>
  );
}

function AppointmentRow({ a, dentistMap }: { a: any; dentistMap: Map<string, string> }) {
  const meta = STATUS_META[a.status] ?? STATUS_META.scheduled;
  const Icon = meta.icon;
  const color = a.procedures?.color ?? 'hsl(var(--primary))';
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="min-w-[60px] text-center">
        <p className="text-base font-semibold">{format(parseISO(a.start_time), 'HH:mm')}</p>
        <p className="text-[10px] text-muted-foreground">{format(parseISO(a.end_time), 'HH:mm')}</p>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{a.patients?.full_name ?? 'Paciente'}</p>
          <Badge variant="outline" className={`gap-1 text-[10px] ${meta.className}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {a.procedures?.name && (
            <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{a.procedures.name}</span>
          )}
          {a.dentist_id && (
            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{dentistMap.get(a.dentist_id) ?? '—'}</span>
          )}
          {a.clinics?.name && (
            <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{a.clinics.name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({ grouped, dentistMap }: { grouped: Record<string, any[]>; dentistMap: Map<string, string> }) {
  const dates = Object.keys(grouped).sort();
  return (
    <div className="space-y-4">
      {dates.map((d) => (
        <Card key={d} className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium capitalize">
              {format(parseISO(d + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                {grouped[d].length} consulta{grouped[d].length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grouped[d].map((a) => <AppointmentRow key={a.id} a={a} dentistMap={dentistMap} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WeekGrid({
  days,
  grouped,
  dentistMap,
  onDayClick,
}: {
  days: Date[];
  grouped: Record<string, any[]>;
  dentistMap: Map<string, string>;
  onDayClick: (d: Date) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const items = grouped[key] ?? [];
        return (
          <Card
            key={key}
            className={`rounded-xl ${isToday(day) ? 'ring-2 ring-primary/30' : ''}`}
          >
            <CardHeader
              className="pb-2 cursor-pointer"
              onClick={() => onDayClick(day)}
            >
              <CardTitle className="text-xs font-medium capitalize flex items-center justify-between">
                <span>{format(day, 'EEE dd', { locale: ptBR })}</span>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 px-2 pb-3">
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-2">—</p>
              ) : (
                items.slice(0, 6).map((a) => {
                  const color = a.procedures?.color ?? 'hsl(var(--primary))';
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg p-1.5 text-[11px]"
                      style={{ backgroundColor: `${color}15`, borderLeft: `2px solid ${color}` }}
                    >
                      <p className="font-medium">{format(parseISO(a.start_time), 'HH:mm')} {a.patients?.full_name?.split(' ')[0] ?? ''}</p>
                      <p className="text-muted-foreground truncate">{a.procedures?.name ?? 'Consulta'}</p>
                    </div>
                  );
                })
              )}
              {items.length > 6 && (
                <p className="text-[10px] text-muted-foreground text-center">+{items.length - 6} mais</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AvailabilityPanel({ operatorId }: { operatorId: string | null }) {
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['op-availability', operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('professional_user_id')
        .eq('operator_id', operatorId!)
        .eq('status', 'approved');
      const userIds = [...new Set((creds ?? []).map((c: any) => c.professional_user_id))];
      if (userIds.length === 0) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const future = format(addDays(new Date(), 14), 'yyyy-MM-dd');
      const { data: avail } = await supabase
        .from('professional_availability')
        .select('id, user_id, work_date, start_time, end_time, mode')
        .in('user_id', userIds)
        .gte('work_date', today)
        .lte('work_date', future)
        .in('mode', ['plano', 'ambos'])
        .order('work_date', { ascending: true })
        .order('start_time', { ascending: true });
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', userIds);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));
      return ((avail ?? []) as any[]).map((s) => ({ ...s, full_name: pmap.get(s.user_id) ?? '—' }));
    },
  });

  const grouped = slots.reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.work_date] ??= []).push(s);
    return acc;
  }, {});

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (Object.keys(grouped).length === 0)
    return (
      <Card className="rounded-xl p-12 text-center text-sm text-muted-foreground">
        <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
        Nenhum horário disponível no momento.
      </Card>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Horários liberados pelos profissionais credenciados nos próximos 14 dias.
      </p>
      {Object.entries(grouped).map(([date, items]) => (
        <Card key={date} className="rounded-xl p-4">
          <div className="font-medium mb-3 capitalize">
            {format(new Date(date + 'T00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map((s: any) => (
              <div key={s.id} className="text-sm border border-border rounded-xl p-2">
                <div className="font-medium">{s.full_name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)} ·{' '}
                  {s.mode === 'plano' ? 'Reservado p/ plano' : 'Particular + plano'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}