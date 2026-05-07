import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PauseState {
  pausedAt: number | null;
  accumulatedPausedMs: number;
}

function pauseKey(id: string) {
  return `consultation-pause-${id}`;
}

export function readPause(appointmentId: string): PauseState {
  try {
    const raw = localStorage.getItem(pauseKey(appointmentId));
    if (!raw) return { pausedAt: null, accumulatedPausedMs: 0 };
    return JSON.parse(raw);
  } catch {
    return { pausedAt: null, accumulatedPausedMs: 0 };
  }
}

export function writePause(appointmentId: string, state: PauseState) {
  localStorage.setItem(pauseKey(appointmentId), JSON.stringify(state));
}

export function clearPause(appointmentId: string) {
  localStorage.removeItem(pauseKey(appointmentId));
}

export function computeElapsed(startedAtIso: string | null | undefined, pause: PauseState): number {
  if (!startedAtIso) return 0;
  const started = new Date(startedAtIso).getTime();
  const now = Date.now();
  let pausedMs = pause.accumulatedPausedMs;
  if (pause.pausedAt) pausedMs += now - pause.pausedAt;
  return Math.max(0, Math.floor((now - started - pausedMs) / 1000));
}

export function useActiveConsultation() {
  const { user } = useAuth();
  const [tick, setTick] = useState(0);

  const { data: appointment } = useQuery({
    queryKey: ['active-consultation', user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, status, presence_status, service_started_at, start_time, patient_id, patients(full_name)')
        .eq('dentist_id', user!.id)
        .eq('status', 'in_progress')
        .eq('presence_status', 'in_service')
        .order('service_started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (!appointment) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [appointment]);

  if (!appointment) return null;

  const pause = readPause(appointment.id);
  const elapsed = computeElapsed(appointment.service_started_at, pause);

  return {
    appointmentId: appointment.id as string,
    patientId: appointment.patient_id as string,
    patientName: (appointment as any).patients?.full_name as string | undefined,
    startedAt: appointment.service_started_at as string | null,
    elapsedSeconds: elapsed,
    isPaused: !!pause.pausedAt,
    _tick: tick,
  };
}