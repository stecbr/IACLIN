import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, CheckCircle2, X, Receipt, User as UserIcon } from 'lucide-react';

export interface BudgetApprovalRequest {
  id: string;
  title: string;
  description: string | null;
  total_cost: number;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  dentist_id?: string | null;
  patient_name?: string;
  dentist_name?: string;
  items?: Array<{ name: string; price: number }>;
}

function initials(name?: string) {
  return (name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  request: BudgetApprovalRequest;
  onApprove?: () => void;
  onReject?: () => void;
  loading?: boolean;
}

export function BudgetApprovalCard({ request, onApprove, onReject, loading }: Props) {
  const isPending = request.status === 'awaiting_clinic_approval';

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{request.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {format(parseISO(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
          {isPending && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 whitespace-nowrap">
              Aguardando
            </Badge>
          )}
          {request.status === 'pending' && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
              Aprovado
            </Badge>
          )}
          {request.status === 'rejected_by_clinic' && (
            <Badge variant="outline" className="bg-rose-500/10 text-rose-700 border-rose-500/30">
              Recusado
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar className="h-5 w-5 flex-shrink-0">
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                {initials(request.patient_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{request.patient_name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <UserIcon className="h-3.5 w-3.5" />
            <span className="truncate">Dr(a). {request.dentist_name ?? '—'}</span>
          </div>
        </div>

        {request.items && request.items.length > 0 && (
          <div className="rounded-md bg-muted/40 p-2 space-y-1">
            {request.items.slice(0, 4).map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="truncate pr-2">{it.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">{brl(it.price)}</span>
              </div>
            ))}
            {request.items.length > 4 && (
              <p className="text-[11px] text-muted-foreground italic">
                +{request.items.length - 4} item(ns)…
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Total
          </span>
          <span className="text-sm font-semibold">{brl(Number(request.total_cost))}</span>
        </div>

        {request.description && (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
            {request.description}
          </p>
        )}

        {request.rejection_reason && (
          <div className="text-xs text-rose-700 bg-rose-50 dark:bg-rose-950/30 rounded-md p-2">
            <span className="font-medium">Motivo:</span> {request.rejection_reason}
          </div>
        )}

        {isPending && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onApprove} disabled={loading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} disabled={loading} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:border-rose-300">
              <X className="h-3.5 w-3.5" /> Recusar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}