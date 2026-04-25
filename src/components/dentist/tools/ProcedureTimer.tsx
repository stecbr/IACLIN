import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Preset {
  id: string;
  label: string;
  seconds: number;
}

const PRESETS: Preset[] = [
  { id: 'etch', label: 'Condicionamento ácido', seconds: 15 },
  { id: 'cure', label: 'Fotopolimerização', seconds: 20 },
  { id: 'cure-long', label: 'Fotopolimerização longa', seconds: 40 },
  { id: 'prophy', label: 'Profilaxia (1 sextante)', seconds: 60 },
  { id: 'rinse', label: 'Bochecho clorexidina', seconds: 60 },
  { id: 'fluor', label: 'Aplicação de flúor', seconds: 240 },
];

function formatTime(s: number): string {
  const sign = s < 0 ? '-' : '';
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${sign}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function playBeep() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 350);
  } catch {
    // ignore
  }
}

export function ProcedureTimer() {
  const [mode, setMode] = useState<'count-up' | 'count-down'>('count-up');
  const [target, setTarget] = useState<number>(0); // for count-down
  const [elapsed, setElapsed] = useState<number>(0); // ms accumulated when paused
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [, force] = useState(0);
  const startedAt = useRef<number | null>(null);
  const beeped = useRef(false);

  // tick
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [running]);

  const liveSeconds = (() => {
    let total = elapsed;
    if (running && startedAt.current) {
      total += Date.now() - startedAt.current;
    }
    return Math.floor(total / 1000);
  })();

  const display = mode === 'count-down' ? target - liveSeconds : liveSeconds;

  // beep when count-down hits zero
  useEffect(() => {
    if (mode === 'count-down' && running && display <= 0 && !beeped.current) {
      beeped.current = true;
      if (!muted) playBeep();
    }
  }, [display, mode, running, muted]);

  // tab title (background indicator)
  useEffect(() => {
    if (!running) return;
    const original = document.title;
    document.title = `⏱ ${formatTime(display)} · IACLIN`;
    return () => {
      document.title = original;
    };
  }, [display, running]);

  const start = () => {
    if (running) return;
    startedAt.current = Date.now();
    setRunning(true);
  };

  const pause = () => {
    if (!running) return;
    if (startedAt.current) {
      setElapsed((e) => e + (Date.now() - startedAt.current!));
    }
    startedAt.current = null;
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    startedAt.current = null;
    setElapsed(0);
    beeped.current = false;
  };

  const choosePreset = (preset: Preset) => {
    reset();
    setMode('count-down');
    setTarget(preset.seconds);
    setActivePreset(preset.id);
  };

  const switchToFreeMode = () => {
    reset();
    setMode('count-up');
    setTarget(0);
    setActivePreset(null);
  };

  const isOvertime = mode === 'count-down' && display < 0;

  return (
    <div className="space-y-6">
      <Card className={cn('border-2 transition-colors', isOvertime ? 'border-destructive bg-destructive/5' : running ? 'border-primary bg-primary/5' : 'border-border')}>
        <CardContent className="p-8 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            {activePreset ? PRESETS.find((p) => p.id === activePreset)?.label : 'Cronômetro livre'}
          </p>
          <div className={cn('text-7xl font-mono font-bold tabular-nums', isOvertime ? 'text-destructive' : running ? 'text-primary' : 'text-foreground')}>
            {formatTime(display)}
          </div>
          <div className="flex items-center justify-center gap-3 mt-6">
            {!running ? (
              <Button size="lg" onClick={start} className="min-w-[120px]">
                <Play className="h-5 w-5" />
                Iniciar
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={pause} className="min-w-[120px]">
                <Pause className="h-5 w-5" />
                Pausar
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={reset}>
              <RotateCcw className="h-5 w-5" />
              Zerar
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Ativar som' : 'Silenciar'}>
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Presets</p>
          {activePreset && (
            <Button variant="ghost" size="sm" onClick={switchToFreeMode} className="text-xs h-7">
              Modo livre
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => choosePreset(p)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                activePreset === p.id
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <p className="text-sm font-medium leading-tight">{p.label}</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{formatTime(p.seconds)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}