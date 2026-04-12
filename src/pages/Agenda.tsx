import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isSameDay, isToday, parseISO, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentFormDialog } from '@/components/agenda/AppointmentFormDialog';

type View = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 - 19:00

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('week');
  const [showForm, setShowForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const { user } = useAuth();

  const range = useMemo(() => {
    if (view === 'day') return { start: currentDate, end: currentDate };
    if (view === 'week') return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }, [currentDate, view]);

  const days = useMemo(() => eachDayOfInterval(range), [range]);

  const { data: appointments = [], refetch } = useQuery({
    queryKey: ['appointments', range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, patients(full_name), procedures(name, color)')
        .gte('start_time', range.start.toISOString())
        .lte('start_time', addDays(range.end, 1).toISOString())
        .order('start_time');
      if (error) throw error;
      return data;
    },
  });

  const navigate = (dir: 1 | -1) => {
    const fn = dir === 1
      ? (view === 'day' ? addDays : view === 'week' ? addWeeks : addMonths)
      : (view === 'day' ? subDays : view === 'week' ? subWeeks : subMonths);
    setCurrentDate(fn(currentDate, 1));
  };

  const getAptsForDay = (day: Date) =>
    appointments.filter((a: any) => isSameDay(parseISO(a.start_time), day));

  const statusColors: Record<string, string> = {
    scheduled: 'border-l-blue-400',
    confirmed: 'border-l-emerald-400',
    completed: 'border-l-green-400',
    no_show: 'border-l-rose-400',
    cancelled: 'border-l-gray-300',
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agenda</h1>
        </div>
        <Button onClick={() => { setSelectedSlot(null); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Consulta
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground ml-2 capitalize">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(['day', 'week', 'month'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      {view === 'month' ? (
        <MonthView days={days} appointments={appointments} onDayClick={(d) => { setCurrentDate(d); setView('day'); }} />
      ) : (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Day Headers */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}>
            <div className="p-2 border-r border-border" />
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={`p-2 text-center border-r border-border last:border-r-0 ${isToday(day) ? 'bg-primary/5' : ''}`}
              >
                <p className="text-xs text-muted-foreground capitalize">{format(day, 'EEE', { locale: ptBR })}</p>
                <p className={`text-sm font-semibold ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                  {format(day, 'dd')}
                </p>
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-border last:border-b-0"
                style={{ gridTemplateColumns: `60px repeat(${days.length}, 1fr)` }}
              >
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-r border-border">
                  {`${hour}:00`}
                </div>
                {days.map((day) => {
                  const dayApts = getAptsForDay(day).filter(
                    (a: any) => new Date(a.start_time).getHours() === hour
                  );
                  return (
                    <div
                      key={day.toISOString() + hour}
                      className="min-h-[60px] p-1 border-r border-border last:border-r-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => handleSlotClick(day, hour)}
                    >
                      {dayApts.map((apt: any) => (
                        <div
                          key={apt.id}
                          className={`rounded-md px-2 py-1 mb-1 text-xs border-l-2 bg-card shadow-sm ${statusColors[apt.status] ?? 'border-l-blue-400'}`}
                        >
                          <p className="font-medium truncate">{(apt as any).patients?.full_name}</p>
                          <p className="text-muted-foreground truncate">
                            {(apt as any).procedures?.name ?? 'Consulta'}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <AppointmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={refetch}
        defaultDate={selectedSlot?.date}
        defaultHour={selectedSlot?.hour}
      />
    </div>
  );
}

function MonthView({ days, appointments, onDayClick }: { days: Date[]; appointments: any[]; onDayClick: (d: Date) => void }) {
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  // Pad start to Monday
  const firstDay = days[0];
  const startPad = (firstDay.getDay() + 6) % 7;
  const paddedDays: (Date | null)[] = [...Array(startPad).fill(null), ...days];
  // Pad end to fill row
  while (paddedDays.length % 7 !== 0) paddedDays.push(null);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="grid grid-cols-7">
        {weekDays.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b border-border">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[80px] border-b border-r border-border bg-muted/20" />;
          const dayApts = appointments.filter((a: any) => isSameDay(parseISO(a.start_time), day));
          return (
            <div
              key={i}
              className={`min-h-[80px] p-1.5 border-b border-r border-border cursor-pointer hover:bg-muted/30 transition-colors ${
                isToday(day) ? 'bg-primary/5' : ''
              }`}
              onClick={() => onDayClick(day)}
            >
              <p className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>
                {format(day, 'd')}
              </p>
              {dayApts.slice(0, 3).map((apt: any) => (
                <div
                  key={apt.id}
                  className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate"
                  style={{ backgroundColor: ((apt as any).procedures?.color ?? '#3B82F6') + '20', color: (apt as any).procedures?.color ?? '#3B82F6' }}
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
