import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { CalendarOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import { DayShiftsPanel, type Shift } from '@/components/availability/DayShiftsPanel';
import { HolidayConfirmDialog } from '@/components/availability/HolidayConfirmDialog';
import { MonthlyDeadlineBanner } from '@/components/availability/MonthlyDeadlineBanner';
import { getHolidayForDate, toLocalDateStr } from '@/lib/holidays';

export default function Availability() {
  const { user, currentClinicId } = useAuth();
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
    queryKey: ['professional-availability', currentClinicId, user?.id],
    queryFn: async () => {
      if (!user || !currentClinicId) return [];
      const { data, error } = await supabase
        .from('professional_availability')
        .select('id, work_date, start_time, end_time, is_holiday_override')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinicId);
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!user && !!currentClinicId,
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

  if (!currentClinicId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Disponibilidade" description="Defina seus dias e horários de atendimento." />
        <Card className="p-10 text-center border-dashed">
          <CalendarOff className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Você precisa estar vinculado a uma clínica para configurar sua disponibilidade.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidade"
        description="Selecione os dias e configure seus turnos. Os horários aparecem automaticamente para os pacientes."
      />

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

        {selectedDate && user && (
          <DayShiftsPanel
            date={selectedDate}
            shifts={selectedShifts}
            clinicId={currentClinicId}
            userId={user.id}
            holiday={selectedHoliday}
          />
        )}
      </div>

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
