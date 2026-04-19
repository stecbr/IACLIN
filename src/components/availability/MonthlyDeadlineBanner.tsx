import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthlyDeadlineBannerProps {
  hasNextMonthAvailability: boolean;
}

export function MonthlyDeadlineBanner({ hasNextMonthAvailability }: MonthlyDeadlineBannerProps) {
  const today = new Date();
  const day = today.getDate();
  const nextMonth = addMonths(today, 1);
  const nextMonthLabel = format(nextMonth, "MMMM 'de' yyyy", { locale: ptBR });

  let tone: 'info' | 'warning' | 'danger' | 'success' = 'info';
  if (hasNextMonthAvailability) tone = 'success';
  else if (day > 15) tone = 'danger';
  else if (day > 10) tone = 'warning';

  const styles = {
    info: 'border-primary/20 bg-primary/5 text-foreground',
    warning: 'border-amber-500/30 bg-amber-500/10 text-foreground',
    danger: 'border-destructive/30 bg-destructive/10 text-foreground',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-foreground',
  }[tone];

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? CalendarClock : AlertTriangle;

  return (
    <div className={cn('rounded-xl border p-4 flex items-start gap-3', styles)}>
      <Icon className={cn(
        'h-5 w-5 mt-0.5 flex-shrink-0',
        tone === 'success' && 'text-emerald-600',
        tone === 'danger' && 'text-destructive',
        tone === 'warning' && 'text-amber-600',
        tone === 'info' && 'text-primary',
      )} />
      <div className="flex-1 min-w-0">
        {tone === 'success' ? (
          <>
            <p className="text-sm font-medium">Tudo certo!</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sua agenda de <span className="capitalize">{nextMonthLabel}</span> já está configurada.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              Defina sua agenda de <span className="capitalize">{nextMonthLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tone === 'danger'
                ? `Prazo expirado (dia 15). Configure agora para liberar agendamentos.`
                : tone === 'warning'
                ? `Faltam ${15 - day} dias para o prazo (dia 15 deste mês).`
                : `Você tem até o dia 15 deste mês para configurar.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
