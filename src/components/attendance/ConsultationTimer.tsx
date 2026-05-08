import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  computeElapsedSeconds,
  getSession,
  pauseSession,
  resumeSession,
  startSession,
  subscribeSession,
} from '@/lib/consultationSession';
import { formatHMS } from '@/lib/formatDuration';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Props {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  serviceStartedAt: string | null;
}

export function ConsultationTimer({ appointmentId, patientId, patientName, serviceStartedAt }: Props) {
  const [, force] = useState(0);
  const initRef = useRef(false);
  const queryClient = useQueryClient();

  // Start (or resume) the local session as soon as we mount.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const startedAtIso = serviceStartedAt ?? new Date().toISOString();
    startSession({ appointmentId, patientId, patientName, startedAt: startedAtIso });
    // Best-effort server sync.
    supabase
      .from('appointments')
      .update({
        service_started_at: startedAtIso,
        presence_status: 'in_service',
        status: 'in_progress',
      })
      .eq('id', appointmentId)
      .then(({ error }) => {
        if (error) console.warn('[ConsultationTimer] server sync failed', error);
        queryClient.invalidateQueries({ queryKey: ['appointment-detail', appointmentId] });
      });
  }, [appointmentId, patientId, patientName, serviceStartedAt, queryClient]);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    const unsub = subscribeSession(() => force((n) => n + 1));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  const session = getSession();
  const isPaused = !!session?.pausedAt;
  const elapsed = computeElapsedSeconds(session);

  const togglePause = () => {
    if (isPaused) resumeSession();
    else pauseSession();
  };

  return (
    <Card className={cn('border-border/50 transition-colors', isPaused ? 'bg-muted/40' : 'bg-primary/5 border-primary/30')}>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <div className={cn('h-9 w-9 rounded-full flex items-center justify-center', isPaused ? 'bg-muted' : 'bg-primary/10')}>
            <Timer className={cn('h-4 w-4', isPaused ? 'text-muted-foreground' : 'text-primary')} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {isPaused ? 'Consulta pausada' : 'Em consulta'}
            </p>
            <p className="text-2xl font-mono font-semibold tabular-nums leading-none mt-0.5">
              {formatHMS(elapsed)}
            </p>
          </div>
        </div>
        <Button size="sm" variant={isPaused ? 'default' : 'outline'} onClick={togglePause} className="gap-1.5">
          {isPaused ? <><Play className="h-3.5 w-3.5" /> Retomar</> : <><Pause className="h-3.5 w-3.5" /> Pausar</>}
        </Button>
      </div>
    </Card>
  );
}
