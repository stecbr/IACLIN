import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Preset { id: string; label: string; minutes: number }

const PRESETS: Preset[] = [
  { id: 'short', label: 'Sessão breve', minutes: 30 },
  { id: 'standard', label: 'Sessão padrão', minutes: 50 },
  { id: 'extended', label: 'Sessão estendida', minutes: 80 },
  { id: 'group', label: 'Grupo / casal', minutes: 90 },
];

function fmt(s: number): string {
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function beep(freq = 880) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 350);
  } catch {}
}

export function SessionTimer() {
  const [target, setTarget] = useState(50 * 60);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [preset, setPreset] = useState<string>('standard');
  const [, force] = useState(0);
  const startedAt = useRef<number | null>(null);
  const warned5 = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [running]);

  const liveSec = (() => {
    let total = elapsed;
    if (running && startedAt.current) total += Date.now() - startedAt.current;
    return Math.floor(total / 1000);
  })();

  const remaining = target - liveSec;

  useEffect(() => {
    if (running && remaining <= 5 * 60 && remaining > 0 && !warned5.current) {
      warned5.current = true;
      if (!muted) beep(660);
    }
    if (running && remaining <= 0 && !ended.current) {
      ended.current = true;
      if (!muted) { beep(880); setTimeout(() => beep(880), 400); }
    }
  }, [remaining, running, muted]);

  useEffect(() => {
    if (!running) return;
    const orig = document.title;
    document.title = `🧠 ${fmt(remaining)} · IACLIN`;
    return () => { document.title = orig; };
  }, [remaining, running]);

  const start = () => {
    if (running) return;
    startedAt.current = Date.now();
    setRunning(true);
  };
  const pause = () => {
    if (!running) return;
    if (startedAt.current) setElapsed((e) => e + (Date.now() - startedAt.current!));
    startedAt.current = null;
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    startedAt.current = null;
    setElapsed(0);
    warned5.current = false;
    ended.current = false;
  };

  const choose = (p: Preset) => {
    reset();
    setTarget(p.minutes * 60);
    setPreset(p.id);
  };

  const overtime = remaining < 0;

  return (
    <div className="space-y-6">
      <Card className={cn('border-2 transition-colors', overtime ? 'border-destructive bg-destructive/5' : running ? 'border-primary bg-primary/5' : 'border-border')}>
        <CardContent className="p-8 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            {PRESETS.find((p) => p.id === preset)?.label}
          </p>
          <div className={cn('text-7xl font-mono font-bold tabular-nums', overtime ? 'text-destructive' : running ? 'text-primary' : 'text-foreground')}>
            {fmt(remaining)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {overtime ? 'Sessão excedida' : `Duração total: ${target / 60} min`}
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            {!running ? (
              <Button size="lg" onClick={start} className="min-w-[120px]"><Play className="h-5 w-5" />Iniciar</Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={pause} className="min-w-[120px]"><Pause className="h-5 w-5" />Pausar</Button>
            )}
            <Button size="lg" variant="outline" onClick={reset}><RotateCcw className="h-5 w-5" />Zerar</Button>
            <Button size="lg" variant="ghost" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tipos de sessão</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                preset === p.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:bg-muted/40'
              )}
            >
              <p className="text-sm font-medium leading-tight">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{p.minutes} min</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">Aviso sonoro aos 5 min finais e ao término.</p>
      </div>
    </div>
  );
}
