import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Maps JS getDay() (0=Sun) to business_hours key
const DOW_KEY: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};
const SLOT_INTERVAL = 30; // minutes between slots

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fromMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export interface TimeSlotInfo {
  value: string; // "HH:mm"
  available: boolean;
  reason?: 'past' | 'occupied';
}

export interface UseAvailableTimeSlotsResult {
  slots: TimeSlotInfo[];           // all generated slots with status
  availableSlots: string[];        // only available HH:mm values
  isLoading: boolean;
  emptyMessage: string | null;
  clinicOpen: boolean;
  clinicHoursLabel: string | null; // e.g. "08:00–18:00"
  findNextSlot: (afterTime?: string) => string | null;
  validateTime: (time: string) => { valid: boolean; reason?: string };
}

interface Params {
  date: string;           // yyyy-MM-dd
  duration: number;       // minutes
  dentistId?: string;
  clinicId?: string | null;
  enabled?: boolean;
}

export function useAvailableTimeSlots({
  date,
  duration,
  dentistId,
  clinicId,
  enabled = true,
}: Params): UseAvailableTimeSlotsResult {
  // Use sv-SE locale to reliably get yyyy-MM-dd from toLocaleDateString
  const todayStr = new Date().toLocaleDateString('sv');
  const isToday = date === todayStr;

  // Live clock — ticks every minute so past slots disappear automatically
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [enabled]);

  const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

  // ── Clinic business hours ──────────────────────────────────────────────
  const { data: clinicData, isLoading: clinicLoading } = useQuery({
    queryKey: ['clinic-business-hours', clinicId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinics')
        .select('business_hours')
        .eq('id', clinicId!)
        .maybeSingle();
      return data;
    },
    enabled: !!clinicId && enabled,
    staleTime: 5 * 60_000,
  });

  // ── Existing appointments for the day ─────────────────────────────────
  const { data: dayApts = [], isLoading: aptsLoading } = useQuery({
    queryKey: ['day-apts-for-slots', date, dentistId, clinicId],
    queryFn: async () => {
      const start = new Date(date + 'T00:00:00').toISOString();
      const end   = new Date(date + 'T23:59:59').toISOString();
      let q = supabase
        .from('appointments')
        .select('start_time, end_time')
        .gte('start_time', start)
        .lte('start_time', end)
        .neq('status', 'cancelled');
      if (clinicId)  q = q.eq('clinic_id', clinicId);
      if (dentistId) q = q.eq('dentist_id', dentistId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: enabled,
    staleTime: 30_000,
    refetchInterval: 60_000, // stays fresh as new appointments are created
  });

  // ── Parse clinic hours for selected weekday ────────────────────────────
  const { clinicOpen, clinicStart, clinicEnd } = useMemo(() => {
    const fallback = { clinicOpen: true, clinicStart: 8 * 60, clinicEnd: 18 * 60 };
    if (!clinicData?.business_hours) return fallback;
    const bh = clinicData.business_hours as Record<string, any>;
    const dow = new Date(date + 'T12:00:00').getDay();
    const day = bh[DOW_KEY[dow]];
    if (!day?.enabled) return { clinicOpen: false, clinicStart: 0, clinicEnd: 0 };
    return {
      clinicOpen: true,
      clinicStart: toMin(day.open  ?? '08:00'),
      clinicEnd:   toMin(day.close ?? '18:00'),
    };
  }, [clinicData, date]);

  const clinicHoursLabel = clinicOpen
    ? `${fromMin(clinicStart)}–${fromMin(clinicEnd)}`
    : null;

  // ── Occupied time intervals ────────────────────────────────────────────
  const occupied = useMemo(() =>
    dayApts.map(a => ({
      start: new Date(a.start_time).getHours() * 60 + new Date(a.start_time).getMinutes(),
      end:   new Date(a.end_time  ).getHours() * 60 + new Date(a.end_time  ).getMinutes(),
    })),
    [dayApts]
  );

  // ── Generate all slots with status ────────────────────────────────────
  const slots = useMemo<TimeSlotInfo[]>(() => {
    if (!clinicOpen) return [];
    const result: TimeSlotInfo[] = [];
    for (let min = clinicStart; min + duration <= clinicEnd; min += SLOT_INTERVAL) {
      // Past check (only for today)
      if (isToday && min <= nowMinutes) {
        result.push({ value: fromMin(min), available: false, reason: 'past' });
        continue;
      }
      // Conflict check: slot [min, min+duration) vs occupied [o.start, o.end)
      const conflict = occupied.find(o => min < o.end && (min + duration) > o.start);
      if (conflict) {
        result.push({ value: fromMin(min), available: false, reason: 'occupied' });
        continue;
      }
      result.push({ value: fromMin(min), available: true });
    }
    return result;
  }, [clinicOpen, clinicStart, clinicEnd, duration, isToday, nowMinutes, occupied]);

  const availableSlots = useMemo(
    () => slots.filter(s => s.available).map(s => s.value),
    [slots]
  );

  const emptyMessage = useMemo<string | null>(() => {
    if (!clinicOpen) return 'A clínica não abre neste dia da semana.';
    if (availableSlots.length === 0) return 'Não há horários disponíveis para esta data.';
    return null;
  }, [clinicOpen, availableSlots]);

  // ── findNextSlot: first available slot, optionally after a given time ─
  const findNextSlot = (afterTime?: string): string | null => {
    if (!afterTime) return availableSlots[0] ?? null;
    const afterMin = toMin(afterTime);
    return availableSlots.find(s => toMin(s) > afterMin) ?? availableSlots[0] ?? null;
  };

  // ── validateTime: used for manual input ───────────────────────────────
  const validateTime = (time: string): { valid: boolean; reason?: string } => {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return { valid: false, reason: 'Formato inválido (HH:MM).' };
    }
    const mins = toMin(time);
    if (!clinicOpen) {
      return { valid: false, reason: 'A clínica não abre neste dia.' };
    }
    if (mins < clinicStart) {
      return { valid: false, reason: `Antes da abertura (${fromMin(clinicStart)}).` };
    }
    if (mins + duration > clinicEnd) {
      return { valid: false, reason: `Ultrapassa o horário de encerramento (${fromMin(clinicEnd)}).` };
    }
    if (isToday && mins <= nowMinutes) {
      return { valid: false, reason: 'Este horário já passou.' };
    }
    const conflict = occupied.find(o => mins < o.end && (mins + duration) > o.start);
    if (conflict) {
      return {
        valid: false,
        reason: `Conflito com consulta das ${fromMin(conflict.start)} às ${fromMin(conflict.end)}.`,
      };
    }
    return { valid: true };
  };

  return {
    slots,
    availableSlots,
    isLoading: (!!clinicId && clinicLoading) || aptsLoading,
    emptyMessage,
    clinicOpen,
    clinicHoursLabel,
    findNextSlot,
    validateTime,
  };
}
