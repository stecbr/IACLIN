import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, FileText, Stethoscope, Sparkles, ListChecks, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ProcessingStep = 'uploading' | 'transcribing' | 'summarizing' | 'structuring' | 'done';

const STEPS: Array<{ key: ProcessingStep; label: string; icon: any }> = [
  { key: 'uploading',    label: 'Enviando áudio',         icon: Loader2 },
  { key: 'transcribing', label: 'Gerando transcrição',    icon: FileText },
  { key: 'summarizing',  label: 'Criando resumo',         icon: Sparkles },
  { key: 'structuring',  label: 'Estruturando anamnese',  icon: Stethoscope },
  { key: 'done',         label: 'Hipóteses diagnósticas', icon: ListChecks },
];

interface Props {
  open: boolean;
  step: ProcessingStep;
  progress: number; // 0..100
  onCancel?: () => void;
}

export function ProcessingOverlay({ open, step, progress, onCancel }: Props) {
  const idx = STEPS.findIndex((s) => s.key === step);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); }}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (!onCancel) e.preventDefault(); }}
      >
        <div className="flex flex-col items-center gap-5 py-2">
          <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" />
              <circle
                cx="40" cy="40" r="34"
                stroke="hsl(var(--primary))"
                strokeWidth="6" fill="none"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - Math.min(1, Math.max(0, progress / 100)))}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
              {Math.round(progress)}%
            </div>
          </div>
          <div className="w-full space-y-1.5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === idx;
              const done = i < idx;
              return (
                <div key={s.key} className={cn(
                  'flex items-center gap-2 text-sm transition-colors',
                  done ? 'text-foreground' : active ? 'text-primary font-medium' : 'text-muted-foreground/60',
                )}>
                  <Icon className={cn('h-3.5 w-3.5', active && 'animate-spin')} />
                  {s.label}
                </div>
              );
            })}
          </div>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Cancelar e voltar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}