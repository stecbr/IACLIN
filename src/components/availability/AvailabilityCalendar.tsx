import { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from 'date-fns/locale';
import { startOfDay } from 'date-fns';
import { getHolidaysForMonth, toLocalDateStr, type HolidayInfo } from '@/lib/holidays';
import { useState } from 'react';

interface AvailabilityCalendarProps {
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  daysWithShifts: Set<string>; // YYYY-MM-DD
  state?: string | null;
  city?: string | null;
}

export function AvailabilityCalendar({
  selectedDate,
  onSelectDate,
  daysWithShifts,
  state,
  city,
}: AvailabilityCalendarProps) {
  const [month, setMonth] = useState<Date>(selectedDate ?? new Date());

  const holidays = useMemo<Map<string, HolidayInfo>>(
    () => getHolidaysForMonth(month.getFullYear(), month.getMonth(), state, city),
    [month, state, city]
  );

  const today = startOfDay(new Date());

  return (
    <TooltipProvider delayDuration={200}>
      <Calendar
        mode="single"
        selected={selectedDate ?? undefined}
        onSelect={(d) => d && onSelectDate(d)}
        month={month}
        onMonthChange={setMonth}
        locale={ptBR}
        showOutsideDays={false}
        disabled={(d) => d < today}
        className="pointer-events-auto"
        modifiers={{
          hasShifts: (d) => daysWithShifts.has(toLocalDateStr(d)),
          isHoliday: (d) => holidays.has(toLocalDateStr(d)),
        }}
        modifiersClassNames={{
          hasShifts: 'after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary',
          isHoliday: 'ring-1 ring-amber-500/60 ring-inset rounded-md',
        }}
        components={{
          DayContent: ({ date }) => {
            const key = toLocalDateStr(date);
            const holiday = holidays.get(key);
            if (holiday) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full h-full leading-9">{date.getDate()}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    🎉 {holiday.name}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return <span>{date.getDate()}</span>;
          },
        }}
      />
      <div className="flex flex-wrap items-center gap-3 px-2 pt-3 text-[11px] text-muted-foreground border-t mt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Com turnos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-amber-500/60" /> Feriado
        </span>
      </div>
    </TooltipProvider>
  );
}
