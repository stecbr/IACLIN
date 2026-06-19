import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, Navigate } from 'react-router-dom';
import { useIsClinicSignup } from '@/hooks/useIsClinicSignup';
import { useViewMode } from '@/hooks/useViewMode';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppointmentFormDialog } from '@/components/agenda/AppointmentFormDialog';
import { AppointmentDetailDialog } from '@/components/agenda/AppointmentDetailDialog';
import { AiAppointmentRequestsPanel } from '@/components/secretaria-ia/AiAppointmentRequestsPanel';
import { PageHeader } from '@/components/PageHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import {
  AgendaDoctorFilter,
  loadStoredDoctorFilter,
  type DoctorFilterValue,
  type DoctorOption,
} from '@/components/agenda/AgendaDoctorFilter';
import { getAvatarColor, getInitials } from '@/lib/avatarColor';
import { AgendaCompareView } from '@/components/agenda/AgendaCompareView';
import { WaitingTimer } from '@/components/waiting-room/WaitingTimer';
import { syncAgendaAppointments } from '@/hooks/useAiSync';
import { generateAgendaDayPdf } from '@/lib/generateAgendaDayPdf';

type View = 'day' | 'week' | 'month';
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function Agenda() {
  const isClinicSignup = useIsClinicSignup();
  const { viewMode } = useViewMode();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [showForm, setShowForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const { user } = useAuth();
  const { effectiveRole } = useRoleAccess();
  const isDentist = effectiveRole === 'dentist';
  const location = useLocation();
  const isMineOnly = location.pathname.startsWith('/minha-agenda');

  // Clinic-only accounts need Modo Consulta for personal schedule
  if (isClinicSignup && viewMode !== 'consult' && isMineOnly) return <Navigate to="/agenda" replace />;
  const restrictToSelf = isDentist || isMineOnly;
  const gridRef = useRef<HTMLDivElement>(null);
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilterValue>(() =>
    restrictToSelf ? { kind: 'all' } : loadStoredDoctorFilter()
  );
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const handleDoctorsLoaded = useCallback((loadedDoctors: DoctorOption[]) => {
    setDoctors(loadedDoctors);
  }, []);
  const doctorById = useMemo(() => {
    const m = new Map<string, DoctorOption>();
    doctors.forEach((d) => m.set(d.user_id, d));
    return m;
  }, [doctors]);

  const compareDoctors = useMemo(() => {
    if (doctorFilter.kind !== 'compare') return [];
    return doctors.slice(0, 4);
  }, [doctorFilter, doctors]);
  const compareOverflow = doctorFilter.kind === 'compare' && doctors.length > 4;
  const useCompareView =
    !restrictToSelf &&
    doctorFilter.kind === 'compare' &&
    view !== 'month' &&
    compareDoctors.length > 1;

  const range = useMemo(() => {
    if (view === 'day') return { start: currentDate, end: currentDate };
    if (view === 'week') return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }, [currentDate, view]);

  const days = useMemo(() => eachDayOfInterval(range), [range]);
  const { currentClinicId, isPersonalMode } = useAuth();

  const { data: appointments = [], refetch } = useQuery({
    queryKey: [
      'appointments',
      range.start.toISOString(),
      range.end.toISOString(),
      currentClinicId,
      restrictToSelf ? user?.id : doctorFilter.kind === 'one' ? doctorFilter.doctorId : 'all',
    ],
    queryFn: async () => {
      if (!currentClinicId && !isPersonalMode) return [];
      let query = supabase
        .from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', range.start.toISOString())
        .lte('start_time', addDays(range.end, 1).toISOString())
        .neq('status', 'cancelled')
        .order('start_time');
      if (currentClinicId) query = query.eq('clinic_id', currentClinicId);
      else if (isPersonalMode && user) query = query.is('clinic_id', null).eq('dentist_id', user.id);
      if (restrictToSelf && user) query = query.eq('dentist_id', user.id);
      else if (doctorFilter.kind === 'one') query = query.eq('dentist_id', doctorFilter.doctorId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['clinic-holidays', currentClinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('clinic_holidays')
        .select('date, name')
        .eq('clinic_id', currentClinicId!);
      return (data ?? []) as { date: string; name: string }[];
    },
    enabled: !!currentClinicId,
    staleTime: 1000 * 60 * 60,
  });

  const getHoliday = (day: Date) => {
    const ds = format(day, 'yyyy-MM-dd');
    return holidays.find((h) => h.date === ds) ?? null;
  };

  const handlePrint = () => {
    const dayApts = view === 'day'
      ? appointments
      : appointments.filter((a: any) => isSameDay(parseISO(a.start_time), currentDate));
    generateAgendaDayPdf(view === 'day' ? currentDate : currentDate, dayApts, currentClinicId);
  };

  useEffect(() => {
    if (gridRef.current && view !== 'month') {
      const now = new Date();
      const currentHour = now.getHours();
      // Scroll para 1h antes do horário atual, mínimo 6h da manhã
      const targetHour = Math.max(6, currentHour - 1);
      gridRef.current.scrollTop = targetHour * 60;
    }
  }, [view]);

  // Sync agendamentos dos próximos 30 dias para a Secretária IA (fire-and-forget)
  useEffect(() => {
    if (currentClinicId) syncAgendaAppointments(currentClinicId);
  }, [currentClinicId]);

  const navigate = (dir: 1 | -1) => {
    const fn = dir === 1
      ? (view === 'day' ? addDays : view === 'week' ? addWeeks : addMonths)
      : (view === 'day' ? subDays : view === 'week' ? subWeeks : subMonths);
    setCurrentDate(fn(currentDate, 1));
  };

  const getAptsForDay = (day: Date) =>
    appointments.filter((a: any) => isSameDay(parseISO(a.start_time), day));

  const statusLabels: Record<string, string> = {
    scheduled: 'Agendada', confirmed: 'Confirmada', completed: 'Concluída', no_show: 'Faltou', cancelled: 'Cancelada',
  };

  const handleSlotClick = (day: Date, hour: number) => {
    setSelectedSlot({ date: day, hour });
    setShowForm(true);
  };

  const headerLabel = view === 'day'
    ? format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : view === 'week'
    ? `${format(range.start, 'dd MMM', { locale: ptBR })} — ${format(range.end, 'dd MMM yyyy', { locale: ptBR })}`
    : format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });

  const now = new Date();
  const currentHourFrac = now.getHours() + now.getMinutes() / 60;
  const showTimeLine = view !== 'month';
  const timeLineTop = currentHourFrac * 60;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <PageHeader title={isMineOnly ? 'Minha Agenda' : 'Agenda'}>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={() => { setSelectedSlot(null); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </PageHeader>

        {/* Pedidos de agendamento da IA (WhatsApp) aguardando aprovação —
            aparecem aqui na Agenda. Só renderiza quando há pendências. */}
        {!isMineOnly && <AiAppointmentRequestsPanel compact />}

        {/* Navigation — linha 1: setas + data */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground ml-1 capitalize hidden sm:inline">{headerLabel}</span>
          </div>
          {/* linha 1 direita: só view switcher (e médicos no desktop) */}
          <div className="flex items-center gap-2">
            {!restrictToSelf && (
              <div className="hidden sm:block">
                <AgendaDoctorFilter
                  value={doctorFilter}
                  onChange={setDoctorFilter}
                  allowCompare={view !== 'month'}
                  onDoctorsLoaded={handleDoctorsLoaded}
                />
              </div>
            )}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(['day', 'week', 'month'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'day' ? 'Dia' : v === 'week' ? 'Sem' : 'Mês'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* linha 2 mobile: data + filtro médicos */}
        <div className="flex items-center justify-between sm:hidden">
          <span className="text-sm font-medium text-foreground capitalize">{headerLabel}</span>
          {!restrictToSelf && (
            <AgendaDoctorFilter
              value={doctorFilter}
              onChange={setDoctorFilter}
              allowCompare={view !== 'month'}
              onDoctorsLoaded={handleDoctorsLoaded}
            />
          )}
        </div>

        {/* Calendar Grid */}
        {compareOverflow && view !== 'month' && (
          <p className="text-xs text-muted-foreground -mt-2">
            Comparação lado a lado disponível para até 4 médicos. Mostrando os 4 primeiros.
          </p>
        )}
        {view === 'month' ? (
          <MonthView days={days} appointments={appointments} holidays={holidays} onDayClick={(d) => { setCurrentDate(d); setView('day'); }} onAppointmentClick={(apt) => setSelectedAppointment(apt)} />
        ) : useCompareView ? (
          <AgendaCompareView
            days={days}
            doctors={compareDoctors}
            appointments={appointments}
            onSlotClick={(d, h) => handleSlotClick(d, h)}
            onAppointmentClick={(apt) => setSelectedAppointment(apt)}
          />
        ) : (
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
            {/* Scroll horizontal envolve header + grid juntos para sincronizar */}
            <div className="overflow-x-auto">
            <div style={{ minWidth: `${60 + days.length * 80}px` }}>
            {/* Day Headers */}
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(80px, 1fr))` }}>
              <div className="p-2 border-r border-border" />
              {days.map((day) => {
                const holiday = getHoliday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-3 text-center border-r border-border last:border-r-0 ${
                      isToday(day) ? 'bg-primary/5' : holiday ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <p className={`text-xs capitalize ${holiday ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                      {format(day, 'EEE', { locale: ptBR })}
                    </p>
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-0.5 ${
                      isToday(day) ? 'bg-primary text-primary-foreground font-bold' : ''
                    }`}>
                      <span className={`text-lg font-semibold ${
                        isToday(day) ? '' : holiday ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                      }`}>
                        {format(day, 'dd')}
                      </span>
                    </div>
                    {holiday && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 leading-tight truncate px-1" title={holiday.name}>
                        {holiday.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div ref={gridRef} className="max-h-[calc(100vh-340px)] overflow-y-auto relative">
              {showTimeLine && (
                <div
                  className="absolute left-0 right-0 z-10 pointer-events-none"
                  style={{ top: `${timeLineTop}px` }}
                >
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-destructive ml-[48px]" />
                    <div className="flex-1 h-[2px] bg-destructive/60" />
                  </div>
                </div>
              )}

              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid border-b border-border last:border-b-0"
                  style={{ gridTemplateColumns: `60px repeat(${days.length}, minmax(80px, 1fr))` }}
                >
                  <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r border-border h-[60px] flex items-start justify-end pt-1">
                    {`${hour}:00`}
                  </div>
                  {days.map((day) => {
                    const dayApts = getAptsForDay(day).filter(
                      (a: any) => new Date(a.start_time).getHours() === hour
                    );
                    const isHoliday = !!getHoliday(day);
                    return (
                      <div
                        key={day.toISOString() + hour}
                        className={`min-h-[60px] p-1 border-r border-border last:border-r-0 hover:bg-muted/30 cursor-pointer transition-colors ${isHoliday ? 'bg-amber-500/5' : ''}`}
                        onClick={() => handleSlotClick(day, hour)}
                      >
                        {dayApts.map((apt: any) => {
                          const procedureColor = (apt as any).procedures?.color ?? 'hsl(var(--primary))';
                          const showDoctorBadge = !isDentist && doctorFilter.kind === 'all';
                          const doctor = showDoctorBadge ? doctorById.get(apt.dentist_id) : null;
                          const presence = apt.presence_status as string | undefined;
                          const isArrived = presence === 'arrived' && apt.arrived_at;
                          const isInService = presence === 'in_service';
                          return (
                            <Tooltip key={apt.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`relative rounded-lg px-2 py-1.5 mb-1 text-xs transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${
                                    isArrived ? 'ring-1 ring-amber-500/60' : isInService ? 'ring-1 ring-emerald-500/60' : ''
                                  }`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                                  style={{
                                    backgroundColor: `${procedureColor}15`,
                                    borderLeft: `3px solid ${procedureColor}`,
                                  }}
                                >
                                  {showDoctorBadge && (
                                    <span
                                      className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold text-white ring-1 ring-background"
                                      style={{ backgroundColor: getAvatarColor(apt.dentist_id) }}
                                      title={doctor?.full_name ?? ''}
                                    >
                                      {getInitials(doctor?.full_name ?? '?')}
                                    </span>
                                  )}
                                  <p className="font-medium truncate text-foreground">{(apt as any).patients?.full_name}</p>
                                  <p className="text-muted-foreground truncate">
                                    {(apt as any).procedures?.name ?? 'Consulta'}
                                  </p>
                                  {isArrived && (
                                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      <WaitingTimer since={apt.arrived_at} variant="full" />
                                    </div>
                                  )}
                                  {isInService && (
                                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      em atendimento
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[220px]">
                                <div className="space-y-1">
                                  <p className="font-semibold">{(apt as any).patients?.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{(apt as any).procedures?.name ?? 'Consulta'}</p>
                                  <p className="text-xs">{format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}</p>
                                  <p className="text-xs capitalize">{statusLabels[apt.status] ?? apt.status}</p>
                                  {doctor && <p className="text-xs">Dr(a). {doctor.full_name}</p>}
                                  {isArrived && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      Chegou às {format(parseISO(apt.arrived_at), 'HH:mm')}
                                    </p>
                                  )}
                                  {apt.notes && <p className="text-xs text-muted-foreground italic">{apt.notes}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            </div>{/* minWidth wrapper */}
            </div>{/* overflow-x-auto */}
          </div>
        )}

        <AppointmentFormDialog
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={refetch}
          defaultDate={selectedSlot?.date}
          defaultHour={selectedSlot?.hour}
        />
        <AppointmentDetailDialog
          open={!!selectedAppointment}
          onOpenChange={(open) => { if (!open) setSelectedAppointment(null); }}
          appointment={selectedAppointment}
          onStatusChange={refetch}
        />
      </div>
    </TooltipProvider>
  );
}

function MonthView({ days, appointments, holidays, onDayClick, onAppointmentClick }: { days: Date[]; appointments: any[]; holidays: { date: string; name: string }[]; onDayClick: (d: Date) => void; onAppointmentClick: (apt: any) => void }) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const firstDay = days[0];
  const startPad = (firstDay.getDay() + 6) % 7;
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card">
      <div className="grid grid-cols-7">
        {weekDays.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[80px] border-b border-r border-border bg-muted/10" />;
          const dayApts = appointments.filter((a: any) => isSameDay(parseISO(a.start_time), day));
          const holiday = holidays.find((h) => h.date === format(day, 'yyyy-MM-dd')) ?? null;
          return (
            <div
              key={i}
              className={`min-h-[80px] p-1.5 border-b border-r border-border cursor-pointer hover:bg-muted/30 transition-colors ${
                isToday(day) ? 'bg-primary/5' : holiday ? 'bg-amber-500/10' : ''
              }`}
              onClick={() => onDayClick(day)}
            >
              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full mb-0.5 ${
                isToday(day) ? 'bg-primary text-primary-foreground' : ''
              }`}>
                <span className={`text-xs font-medium ${
                  isToday(day) ? '' : holiday ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                }`}>
                  {format(day, 'd')}
                </span>
              </div>
              {holiday && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium leading-tight truncate mb-0.5" title={holiday.name}>
                  {holiday.name}
                </p>
              )}
              {dayApts.slice(0, 3).map((apt: any) => (
                <div
                  key={apt.id}
                  className="text-[10px] px-1.5 py-0.5 rounded-md mb-0.5 truncate font-medium cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                  style={{ backgroundColor: ((apt as any).procedures?.color ?? '#3B82F6') + '15', color: (apt as any).procedures?.color ?? '#3B82F6' }}
                >
                  {(apt as any).patients?.full_name?.split(' ')[0]}
                </div>
              ))}
              {dayApts.length > 3 && (
                <p className="text-[10px] text-muted-foreground">+{dayApts.length - 3} mais</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
