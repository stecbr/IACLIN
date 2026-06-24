import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingProgressProps {
  step: 1 | 2 | 3 | 4 | 5;
}

const labels = ['Tipo', 'Especialidade', 'Data', 'Profissional', 'Confirmar'];

export function BookingProgress({ step }: BookingProgressProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
                  !done && !active && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:inline truncate',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {n < labels.length && (
              <div
                className={cn(
                  'h-px flex-1 transition-colors',
                  done ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
