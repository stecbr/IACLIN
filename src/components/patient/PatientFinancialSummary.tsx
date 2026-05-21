import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { usePatientFinancialStatus } from '@/hooks/usePatientFinancialStatus';

function formatBRL(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

interface Props {
  patientId: string;
  onSeeDetails?: () => void;
}

export function PatientFinancialSummary({ patientId, onSeeDetails }: Props) {
  const { data, isLoading } = usePatientFinancialStatus(patientId);

  if (isLoading || !data) {
    return <Card className="p-4 h-24 animate-pulse bg-muted/40" />;
  }

  if (data.total === 0) {
    return null;
  }

  const statusConfig = {
    up_to_date: {
      label: 'Em dia',
      icon: CheckCircle2,
      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      ring: 'border-emerald-200/60 dark:border-emerald-900/40',
    },
    pending: {
      label: `${data.pendingCount} em aberto`,
      icon: Clock,
      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      ring: 'border-amber-200/60 dark:border-amber-900/40',
    },
    overdue: {
      label: `Devendo ${formatBRL(data.overdue)}`,
      icon: AlertCircle,
      cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
      ring: 'border-rose-200/60 dark:border-rose-900/40',
    },
  }[data.status];

  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`p-4 border ${statusConfig.ring}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${statusConfig.cls}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Situação financeira</p>
            <Badge variant="secondary" className={`${statusConfig.cls} mt-0.5`}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(data.paid)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Em aberto</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400">{formatBRL(data.pending)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Atrasado</p>
            <p className="font-semibold text-rose-600 dark:text-rose-400">{formatBRL(data.overdue)}</p>
          </div>
          {onSeeDetails && (
            <button
              onClick={onSeeDetails}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Ver detalhes
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}