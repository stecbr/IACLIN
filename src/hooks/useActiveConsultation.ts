import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  computeElapsedSeconds,
  endSession,
  getSession,
  startSession,
  subscribeSession,
  type ConsultationSession,
} from '@/lib/consultationSession';

// Back-compat helpers kept for other callers.
export function computeElapsed(startedAtIso: string | null | undefined): number {
  if (!startedAtIso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000));
}
export function readPause() {
  return { pausedAt: null, accumulatedPausedMs: 0 };
}
export function writePause() {}
export function clearPause() {}

export function useActiveConsultation() {
  const { user } = useAuth();
  const [session, setSessionState] = useState<ConsultationSession | null>(() => getSession());
  const [, force] = useState(0);

  // Subscribe to local session changes (instant updates).
  useEffect(() => {
    const unsub = subscribeSession(() => setSessionState(getSession()));
    return unsub;
  }, []);

  // Tick every second to refresh elapsed.
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  // Validate existing local session against DB — clears stale sessions from deleted/switched accounts.
  useQuery({
    queryKey: ['active-consultation-validate', user?.id, session?.appointmentId],
    enabled: !!user && !!session,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, status, dentist_id')
        .eq('id', session!.appointmentId)
        .maybeSingle();
      const valid = data && data.status === 'in_progress' && data.dentist_id === user!.id;
      if (!valid) {
        endSession();
        setSessionState(null);
      }
      return valid;
    },
  });

  // Server hydration: if no local session, look for any in_progress appt for this user.
  useQuery({
    queryKey: ['active-consultation-hydrate', user?.id],
    enabled: !!user && !session,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, service_started_at, start_time, patient_id, patients(full_name)')
        .eq('dentist_id', user!.id)
        .eq('status', 'in_progress')
        .order('service_started_at', { ascending: false, nullsFirst: false })
        .limit(1);
      const apt = data?.[0];
      if (apt) {
        startSession({
          appointmentId: apt.id,
          patientId: apt.patient_id,
          patientName: (apt as any).patients?.full_name,
          startedAt: apt.service_started_at ?? apt.start_time,
        });
        setSessionState(getSession());
      }
      return apt ?? null;
    },
  });

  if (!session) return null;

  return {
    appointmentId: session.appointmentId,
    patientId: session.patientId,
    patientName: session.patientName,
    startedAt: session.startedAt,
    elapsedSeconds: computeElapsedSeconds(session),
    isPaused: !!session.pausedAt,
  };
}
