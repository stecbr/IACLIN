import { useEffect, useRef } from 'react';
import { Pause, Play, StopCircle, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AudioRecorderState } from '@/hooks/useAudioRecorder';

interface Props {
  state: AudioRecorderState;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecordingFloatingBar({ state, onPause, onResume, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barsRef = useRef<number[]>(Array(40).fill(0.05));

  useEffect(() => {
    if (state.status !== 'recording' && state.status !== 'paused') return;
    barsRef.current = [...barsRef.current.slice(1), state.level || 0.05];
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    const barW = w / barsRef.current.length;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue('--primary').trim() || '220 80% 50%';
    const accent = styles.getPropertyValue('--accent-foreground').trim() || primary;
    grad.addColorStop(0, `hsl(${primary})`);
    grad.addColorStop(1, `hsl(${accent})`);
    ctx.fillStyle = grad;
    barsRef.current.forEach((v, i) => {
      const bh = Math.max(2, v * h * 0.95);
      ctx.fillRect(i * barW + 1, (h - bh) / 2, barW - 2, bh);
    });
  }, [state.level, state.status]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-full border shadow-2xl backdrop-blur-md',
        'bg-card/90 border-border/60',
        state.status === 'recording' && 'ring-1 ring-primary/40',
      )}>
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        <span className={cn(
          'font-mono text-sm tabular-nums min-w-[52px] text-center',
          state.status === 'recording' ? 'text-foreground' : 'text-muted-foreground',
        )}>
          {fmt(state.durationMs)}
        </span>
        <canvas ref={canvasRef} width={220} height={28} className="rounded" />
        {state.status === 'recording' ? (
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={onPause} title="Pausar">
            <Pause className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" onClick={onResume} title="Retomar">
            <Play className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="destructive" className="h-9 w-9 rounded-full" onClick={onFinish} title="Finalizar">
          <StopCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}