import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BreaksEditor, type BreakItem } from './BreaksEditor';
import { Wand2, Clock, Coffee } from 'lucide-react';
import { toast } from 'sonner';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface FixedPattern {
  start_time: string;
  end_time: string;
  breaks: BreakItem[];
  weekdays: number[];
}

interface Props {
  onApply: (pattern: FixedPattern) => void;
}

export function FixedPatternCard({ onApply }: Props) {
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('18:00');
  const [breaks, setBreaks] = useState<BreakItem[]>([
    { start: '12:00', end: '13:00', label: 'Almoço' },
  ]);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  const toggleDay = (d: number) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const apply = () => {
    if (weekdays.length === 0) {
      toast.error('Selecione ao menos um dia');
      return;
    }
    if (start >= end) {
      toast.error('Horário inicial deve ser anterior ao final');
      return;
    }
    onApply({ start_time: start, end_time: end, breaks, weekdays });
    toast.success('Padrão fixo aplicado aos dias selecionados');
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-semibold">Padrão fixo</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Defina um horário e intervalos padrão e aplique a vários dias de uma vez. Depois ajuste dias específicos abaixo se precisar.
          </p>
        </div>
        <Button size="sm" onClick={apply} className="gap-1.5 shrink-0">
          <Wand2 className="h-3.5 w-3.5" /> Aplicar
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Horário
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-8 w-[110px] text-xs"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-8 w-[110px] text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Dias da semana
          </Label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_SHORT.map((lbl, i) => {
              const active = weekdays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-8 px-2.5 rounded-md text-[11px] font-medium border transition-colors ${
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Coffee className="h-3 w-3 text-muted-foreground" />
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Intervalos
          </Label>
        </div>
        <BreaksEditor value={breaks} onChange={setBreaks} />
      </div>
    </div>
  );
}