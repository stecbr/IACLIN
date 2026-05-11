import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarOff, CalendarRange, Clock, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import { DayShiftsPanel, type Shift } from '@/components/availability/DayShiftsPanel';
import { HolidayConfirmDialog } from '@/components/availability/HolidayConfirmDialog';
import { MonthlyDeadlineBanner } from '@/components/availability/MonthlyDeadlineBanner';
import { WeeklyTemplateTab } from '@/components/availability/WeeklyTemplateTab';
import { DurationSettingsTab } from '@/components/availability/DurationSettingsTab';
import { getHolidayForDate, toLocalDateStr } from '@/lib/holidays';

export default function Availability() {
  const { user, currentClinicId, isPersonalMode } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [pendingHolidayDate, setPendingHolidayDate] = useState<Date | null>(null);

  const { data: clinic } = useQuery({
    queryKey: ['clinic-loc', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return null;
      const { data } = await supabase
        .from('clinics')
        .select('state, city')
        .eq('id', currentClinicId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentClinicId,
  });

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['professional-availability', currentClinicId ?? 'personal', user?.id],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from('professional_availability')
        .select('id, work_date, start_time, end_time, is_holiday_override')
        .eq('user_id', user.id);
      q = currentClinicId ? q.eq('clinic_id', currentClinicId) : q.is('clinic_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!user && (!!currentClinicId || isPersonalMode),
  });

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts as any[]) {
      const arr = map.get(s.work_date) ?? [];
      arr.push(s);
      map.set(s.work_date, arr);
    }
    return map;
  }, [shifts]);

  const daysWithShifts = useMemo(() => new Set(shiftsByDate.keys()), [shiftsByDate]);

  const hasNextMonthAvailability = useMemo(() => {
    const next = addMonths(new Date(), 1);
    const startK = toLocalDateStr(startOfMonth(next));
    const endK = toLocalDateStr(endOfMonth(next));
    for (const k of shiftsByDate.keys()) {
      if (k >= startK && k <= endK) return true;
    }
    return false;
  }, [shiftsByDate]);

  const handleSelectDate = (d: Date) => {
    const holiday = getHolidayForDate(d, clinic?.state, clinic?.city);
    const alreadyHasShifts = daysWithShifts.has(toLocalDateStr(d));
    if (holiday && !alreadyHasShifts) {
      setPendingHolidayDate(d);
      return;
    }
    setSelectedDate(d);
  };

  const confirmHoliday = () => {
    if (pendingHolidayDate) setSelectedDate(pendingHolidayDate);
    setPendingHolidayDate(null);
  };

  const selectedKey = selectedDate ? toLocalDateStr(selectedDate) : null;
  const selectedShifts = selectedKey ? shiftsByDate.get(selectedKey) ?? [] : [];
  const selectedHoliday = selectedDate
    ? getHolidayForDate(selectedDate, clinic?.state, clinic?.city)
    : null;
  const pendingHolidayInfo = pendingHolidayDate
    ? getHolidayForDate(pendingHolidayDate, clinic?.state, clinic?.city)
    : null;

  // Allow either a clinic or personal mode
  const hasScope = !!currentClinicId || isPersonalMode;

  if (!user || !hasScope) {
    return (
      <div className="space-y-6">
        <PageHeader title="Disponibilidade" description="Defina seus dias e horários de atendimento." />
        <Card className="p-10 text-center border-dashed">
          <CalendarOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecione uma clínica ou ative o modo pessoal para configurar sua disponibilidade.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidade"
        description="Configure seu padrão semanal, duração de consulta, intervalos e exceções."
      />

      <Tabs defaultValue="weekly" className="space-y-5">
        <TabsList>
          <TabsTrigger value="weekly" className="gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" /> Padrão semanal
          </TabsTrigger>
          <TabsTrigger value="duration" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Duração & ritmo
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" /> Calendário & exceções
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <WeeklyTemplateTab
            userId={user.id}
            clinicId={currentClinicId}
            scopeIsPersonal={isPersonalMode}
          />
        </TabsContent>

        <TabsContent value="duration">
          <DurationSettingsTab userId={user.id} />
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-6">
          <MonthlyDeadlineBanner hasNextMonthAvailability={hasNextMonthAvailability} />
          <div className="grid gap-6 md:grid-cols-[auto_1fr] items-start">
            <Card className="p-2 w-fit mx-auto md:mx-0">
              {isLoading ? (
                <Skeleton className="h-[320px] w-[280px]" />
              ) : (
                <AvailabilityCalendar
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  daysWithShifts={daysWithShifts}
                  state={clinic?.state}
                  city={clinic?.city}
                />
              )}
            </Card>

            {selectedDate && (
              <DayShiftsPanel
                date={selectedDate}
                shifts={selectedShifts}
                clinicId={currentClinicId ?? ''}
                userId={user.id}
                holiday={selectedHoliday}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <HolidayConfirmDialog
        open={!!pendingHolidayDate}
        date={pendingHolidayDate}
        holidayName={pendingHolidayInfo?.name ?? null}
        onConfirm={confirmHoliday}
        onCancel={() => setPendingHolidayDate(null)}
      />
    </div>
  );
}
