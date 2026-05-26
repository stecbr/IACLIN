import { useEffect, useRef, useState, useCallback } from 'react';
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

type Dock = 'left' | 'right' | null;
const SNAP_THRESHOLD = 48;
const STORAGE_KEY = 'recording-bar-pos-v1';

export function RecordingFloatingBar({ state, onPause, onResume, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const barsRef = useRef<number[]>(Array(40).fill(0.05));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dock, setDock] = useState<Dock>(null);
  const [dragging, setDragging] = useState(false);
  const [snapPreview, setSnapPreview] = useState<Dock>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.dock) setDock(v.dock);
        else if (typeof v.x === 'number' && typeof v.y === 'number') setPos({ x: v.x, y: v.y });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (dock) localStorage.setItem(STORAGE_KEY, JSON.stringify({ dock }));
      else if (pos) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {}
  }, [pos, dock]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    setDock(null);
    setPos({ x: rect.left, y: rect.top });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const x = e.clientX - dragOffset.current.x;
      const y = e.clientY - dragOffset.current.y;
      setPos({ x, y });
      if (e.clientX <= SNAP_THRESHOLD) setSnapPreview('left');
      else if (window.innerWidth - e.clientX <= SNAP_THRESHOLD) setSnapPreview('right');
      else setSnapPreview(null);
    };
    const onUp = (e: PointerEvent) => {
      setDragging(false);
      if (e.clientX <= SNAP_THRESHOLD) {
        setDock('left');
        setPos(null);
      } else if (window.innerWidth - e.clientX <= SNAP_THRESHOLD) {
        setDock('right');
        setPos(null);
      } else {
        const el = containerRef.current;
        if (el) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          setPos((p) => p ? {
            x: Math.max(8, Math.min(window.innerWidth - w - 8, p.x)),
            y: Math.max(8, Math.min(window.innerHeight - h - 8, p.y)),
          } : p);
        }
      }
      setSnapPreview(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

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

  const isDocked = dock !== null;
  const style: React.CSSProperties = isDocked
    ? ({
        position: 'fixed',
        top: '50%',
        transform: 'translateY(-50%)',
        [dock === 'left' ? 'left' : 'right']: 8,
      } as React.CSSProperties)
    : pos
      ? { position: 'fixed', left: pos.x, top: pos.y }
      : { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)' };

  return (
    <>
      {snapPreview && (
        <div
          className="fixed z-40 pointer-events-none bg-primary/15 border-2 border-primary/40 rounded-2xl transition-all"
          style={{
            [snapPreview === 'left' ? 'left' : 'right']: 8,
            width: 80,
            top: 8,
            bottom: 8,
          } as React.CSSProperties}
        />
      )}
      <div
        ref={containerRef}
        style={style}
        className={cn(
          'z-50 select-none',
          dragging ? 'opacity-90' : 'transition-all duration-200',
        )}
      >
        <div className={cn(
          'border shadow-2xl backdrop-blur-md bg-card/90 border-border/60',
          isDocked
            ? 'flex flex-col items-center gap-2 px-2 py-3 rounded-2xl'
            : 'flex items-center gap-3 px-3 py-2 rounded-full',
          state.status === 'recording' && 'ring-1 ring-primary/40',
        )}>
          <button
            type="button"
            onPointerDown={onPointerDown}
            className={cn(
              'touch-none cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground transition-colors',
              isDocked && 'rotate-90',
            )}
            title="Arraste para mover (solte na borda para encaixar)"
            aria-label="Arrastar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className={cn(
            'font-mono text-sm tabular-nums text-center',
            !isDocked && 'min-w-[52px]',
            state.status === 'recording' ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {fmt(state.durationMs)}
          </span>
          {!isDocked && (
            <canvas ref={canvasRef} width={220} height={28} className="rounded" />
          )}
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
    </>
  );
}