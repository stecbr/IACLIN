import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Coffee } from 'lucide-react';

export interface BreakItem {
  start: string; // HH:MM
  end: string;
  label?: string;
}

interface Props {
  value: BreakItem[];
  onChange: (next: BreakItem[]) => void;
  disabled?: boolean;
}

export function BreaksEditor({ value, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<BreakItem>) => {
    const next = value.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () =>
    onChange([...value, { start: '12:00', end: '13:00', label: 'Almoço' }]);

  return (
    <div className="space-y-1.5">
      {value.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Sem intervalos</p>
      ) : (
        value.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Coffee className="h-3 w-3 text-muted-foreground shrink-0" />
            <Input
              type="time"
              value={b.start}
              onChange={(e) => update(i, { start: e.target.value })}
              disabled={disabled}
              className="h-7 w-[88px] text-xs px-1.5"
            />
            <span className="text-[11px] text-muted-foreground">–</span>
            <Input
              type="time"
              value={b.end}
              onChange={(e) => update(i, { end: e.target.value })}
              disabled={disabled}
              className="h-7 w-[88px] text-xs px-1.5"
            />
            <Input
              placeholder="Rótulo"
              value={b.label ?? ''}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={disabled}
              className="h-7 flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={add}
        disabled={disabled}
        className="h-7 gap-1 text-xs text-muted-foreground"
      >
        <Plus className="h-3 w-3" /> Adicionar intervalo
      </Button>
    </div>
  );
}