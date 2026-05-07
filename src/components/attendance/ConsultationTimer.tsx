import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { computeElapsed, readPause, writePause } from '@/hooks/useActiveConsultation';
import { formatHMS } from '@/lib/formatDuration';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Props {
  appointmentId: string;
  serviceStartedAt: string | null;
  onStarted?: (iso: string) => void;
}

export function ConsultationTimer({ appointmentId, serviceStartedAt, onStarted }: Props) {
  const [startedAt, setStartedAt] = useState<string | null>(serviceStartedAt);
  const [, force] = useState(0);
  const [isPaused, setIsPaused] = useState<boolean>(() => !!readPause(appointmentId).pausedAt);
  const initRef = useRef(false);
  const queryClient = useQueryClient();

  // Pull in server value when it eventually arrives, without overriding a locally-set timestamp.
  useEffect(() => {
    if (serviceStartedAt && !startedAt) setStartedAt(serviceStartedAt);
  }, [serviceStartedAt, startedAt]);

  // Ensure service_started_at exists on the server (runs once).
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (startedAt) return;
    const iso = new Date().toISOString();
    setStartedAt(iso);
    onStarted?.(iso);
    supabase
      .from('appointments')
      .update({ service_started_at: iso, presence_status: 'in_service', status: 'in_progress' })
      .eq('id', appointmentId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['appointment-detail', appointmentId] });
        queryClient.invalidateQueries({ queryKey: ['active-consultation'] });
      });
  }, [appointmentId, startedAt, onStarted, queryClient]);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const pause = readPause(appointmentId);
  const elapsed = computeElapsed(startedAt, pause);

  const togglePause = () => {
    const current = readPause(appointmentId);
    if (current.pausedAt) {
      const accumulated = current.accumulatedPausedMs + (Date.now() - current.pausedAt);
      writePause(appointmentId, { pausedAt: null, accumulatedPausedMs: accumulated });
      setIsPaused(false);
    } else {
      writePause(appointmentId, { pausedAt: Date.now(), accumulatedPausedMs: current.accumulatedPausedMs });
      setIsPaused(true);
    }
    force((n) => n + 1);
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
