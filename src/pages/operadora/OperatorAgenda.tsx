import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Phone,
  IdCard,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  isToday,
  isThisWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  completed: { label: 'Concluída', className: 'bg-violet-500/10 text-violet-600 border-violet-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: XCircle },
  no_show: { label: 'Faltou', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: AlertCircle },
};

export default function OperatorAgenda() {
  const { operatorId } = useAuth();
  const [refDate, setRefDate] = useState(new Date());
  const [clinicFilter, setClinicFilter] = useState<string>('all');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Credenciamentos aprovados desta operadora. O credenciamento é por CLÍNICA
  // (uma linha por operador+clínica — ver migration operator_credentialings_clinic_level),
  // não por profissional: professional_user_id só guarda quem solicitou o
  // credenciamento, não a equipe toda da clínica.
  // Busca credenciamentos e clínicas em duas queries separadas — o embed
  // aninhado (`clinics(id, name)`) falha silenciosamente (RLS/FK não inferida
  // pelo PostgREST) e volta null, escondendo clínicas mesmo já credenciadas.
  const { data: clinics = [] } = useQuery({
    queryKey: ['op-creds', operatorId],
    enabled: !!operatorId,
    queryFn: async () => {
      const { data: creds } = await supabase
        .from('operator_credentialings')
        .select('clinic_id')
        .eq('operator_id', operatorId!)
        .eq('status', 'approved');
      const ids = Array.from(new Set((creds ?? []).map((c: any) => c.clinic_id).filter(Boolean)));
      if (ids.length === 0) return [];
      const { data: clinicRows } = await supabase.from('clinics').select('id, name').in('id', ids);
      return (clinicRows ?? []).map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const clinicIds = useMemo(() => clinics.map((c) => c.id), [clinics]);

  // Profissionais (dentistas/admins) que atuam nas clínicas credenciadas —
  // usado para o filtro "Profissional" e para nomear os agendamentos.
  const { data: doctors = [] } = useQuery({
    queryKey: ['op-cred-doctors', clinicIds.join(',')],
    enabled: clinicIds.length > 0,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('clinic_members')
        .select('user_id')
        .in('clinic_id', clinicIds)
        .in('role', ['dentist', 'admin']);
      const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
      if (userIds.length === 0) return [];
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      return (profs ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? '—' }));
    },
  });

  // A agenda sempre mostra o mês corrente — sem alternância de visualização.
  const range = useMemo(
    () => ({ start: startOfMonth(refDate), end: endOfMonth(refDate) }),
    [refDate],
  );

  // Consultas nas clínicas credenciadas a esta operadora. Restringe no
  // servidor por clínica — sem isso a consulta trazia agendamentos de
  // qualquer clínica da plataforma, mesmo sem vínculo com a operadora.
  const { data: appointments = [], isLoading: loadingApts } = useQuery({
    queryKey: ['op-appointments', operatorId, clinicIds.join(','), range.start.toISOString(), range.end.toISOString()],
    enabled: !!operatorId && clinicIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, status, presence_status, clinic_id, dentist_id, notes, patients(full_name, cpf, phone, insurance_provider), procedures(name, color), clinics(name)')
        .in('clinic_id', clinicIds)
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

  // Convênios distintos vistos nos agendamentos carregados (texto livre do
  // cadastro do paciente — não há vínculo formal agendamento↔plano ainda).
  const plans = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a: any) => {
      const p = a.patients?.insurance_provider?.trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [appointments]);

  // Filtros aplicados em memória
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return appointments.filter((a: any) => {
      if (clinicFilter !== 'all' && a.clinic_id !== clinicFilter) return false;
      if (doctorFilter !== 'all' && a.dentist_id !== doctorFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (planFilter !== 'all' && (a.patients?.insurance_provider ?? '') !== planFilter) return false;
      if (q) {
        const hay = `${a.patients?.full_name ?? ''} ${a.patients?.cpf ?? ''} ${a.procedures?.name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, clinicFilter, doctorFilter, statusFilter, planFilter, search]);

  // KPIs (com base no resultado filtrado da janela carregada)
  const kpis = useMemo(() => {
    const today = filtered.filter((a: any) => isToday(parseISO(a.start_time)));
    const week = filtered.filter((a: any) => isThisWeek(parseISO(a.start_time), { weekStartsOn: 1 }));
    const confirmed = filtered.filter((a: any) => a.status === 'confirmed' || a.status === 'completed');
    const pending = filtered.filter((a: any) => a.status === 'scheduled');
    return { today: today.length, week: week.length, confirmed: confirmed.length, pending: pending.length };
  }, [filtered]);

  const navigate = (dir: 1 | -1) => {
    setRefDate(dir === 1 ? addMonths(refDate, 1) : subMonths(refDate, 1));
  };

  const headerLabel = format(refDate, "MMMM 'de' yyyy", { locale: ptBR });

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: range.start, end: range.end }),
    [range],
  );

  const activeFilterCount = [clinicFilter, doctorFilter, planFilter, statusFilter].filter(
    (v) => v !== 'all',
  ).length;

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

      {/* Toolbar */}
      <Card className="rounded-xl">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente, CPF ou procedimento"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 rounded-xl w-64"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="relative rounded-xl">
                    <SlidersHorizontal className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Clínica</p>
                    <Select value={clinicFilter} onValueChange={setClinicFilter}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Clínica" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as clínicas</SelectItem>
                        {clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Profissional</p>
                    <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Profissional" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os profissionais</SelectItem>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Convênio</p>
                    <Select value={planFilter} onValueChange={setPlanFilter}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Convênio" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os convênios</SelectItem>
                        {plans.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Status</p>
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
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setClinicFilter('all');
                        setDoctorFilter('all');
                        setPlanFilter('all');
                        setStatusFilter('all');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingApts ? (
        <Skeleton className="h-[520px] w-full rounded-xl" />
      ) : clinicIds.length === 0 ? (
        <EmptyAppointments noCredentialing />
      ) : (
        <MonthCalendar
          days={monthDays}
          appointments={filtered}
          dentistMap={dentistMap}
          onAppointmentClick={setSelectedAppointment}
        />
      )}

      <AppointmentDetailDialog
        appointment={selectedAppointment}
        dentistMap={dentistMap}
        onOpenChange={(open) => !open && setSelectedAppointment(null)}
      />
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

function EmptyAppointments({ noCredentialing }: { noCredentialing?: boolean }) {
  return (
    <Card className="rounded-xl p-12 text-center text-sm text-muted-foreground">
      <CalendarIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
      {noCredentialing
        ? 'Nenhuma clínica/profissional credenciado a esta operadora ainda. Aprove credenciamentos para ver as consultas aqui.'
        : 'Nenhuma consulta encontrada no período selecionado.'}
    </Card>
  );
}

function MonthCalendar({
  days,
  appointments,
  dentistMap,
  onAppointmentClick,
}: {
  days: Date[];
  appointments: any[];
  dentistMap: Map<string, string>;
  onAppointmentClick: (a: any) => void;
}) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const firstDay = days[0];
  const startPad = (firstDay.getDay() + 6) % 7;
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  return (
    <Card className="rounded-xl overflow-hidden p-0">
      <div className="grid grid-cols-7">
        {weekDays.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[100px] border-b border-r border-border bg-muted/10" />;
          const dayApts = appointments.filter((a: any) => isSameDay(parseISO(a.start_time), day));
          return (
            <div
              key={i}
              className={`min-h-[100px] p-1.5 border-b border-r border-border ${isToday(day) ? 'bg-primary/5' : ''}`}
            >
              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full mb-0.5 ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                <span className="text-xs font-medium">{format(day, 'd')}</span>
              </div>
              {dayApts.slice(0, 3).map((a: any) => {
                const color = a.procedures?.color ?? 'hsl(var(--primary))';
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onAppointmentClick(a)}
                    className="w-full text-left text-[10px] px-1.5 py-0.5 rounded-md mb-0.5 truncate font-medium hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {format(parseISO(a.start_time), 'HH:mm')} {a.patients?.full_name?.split(' ')[0] ?? 'Paciente'}
                  </button>
                );
              })}
              {dayApts.length > 3 && (
                <p className="text-[10px] text-muted-foreground pl-1">+{dayApts.length - 3} mais</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AppointmentDetailDialog({
  appointment,
  dentistMap,
  onOpenChange,
}: {
  appointment: any;
  dentistMap: Map<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  if (!appointment) return null;
  const a = appointment;
  const meta = STATUS_META[a.status] ?? STATUS_META.scheduled;
  const Icon = meta.icon;
  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{a.patients?.full_name ?? 'Paciente'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Badge variant="outline" className={`gap-1 text-[11px] ${meta.className}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          <div className="grid grid-cols-1 gap-2.5 pt-1">
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {format(parseISO(a.start_time), "EEEE, dd 'de' MMMM", { locale: ptBR })} ·{' '}
                {format(parseISO(a.start_time), 'HH:mm')}–{format(parseISO(a.end_time), 'HH:mm')}
              </span>
            </div>
            {a.clinics?.name && (
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{a.clinics.name}</span>
              </div>
            )}
            {a.dentist_id && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Dr(a). {dentistMap.get(a.dentist_id) ?? '—'}</span>
              </div>
            )}
            {a.procedures?.name && (
              <div className="flex items-center gap-2.5">
                <Stethoscope className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{a.procedures.name}</span>
              </div>
            )}
            {a.patients?.cpf && (
              <div className="flex items-center gap-2.5">
                <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{a.patients.cpf}</span>
              </div>
            )}
            {a.patients?.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{a.patients.phone}</span>
              </div>
            )}
            {a.patients?.insurance_provider && (
              <div className="flex items-center gap-2.5">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{a.patients.insurance_provider}</span>
              </div>
            )}
          </div>
          {a.notes && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{a.notes}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

