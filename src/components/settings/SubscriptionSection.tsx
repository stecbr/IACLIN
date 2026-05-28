import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CreditCard, Receipt, Sparkles } from 'lucide-react';
import {
  formatBRL,
  SUB_STATUS_LABELS,
  CYCLE_LABELS,
  METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PlatformSubscription,
  type PlatformPayment,
  type PlanSegment,
  type SubStatus,
  type PaymentStatus,
} from '@/types/superadmin';
import { toast } from 'sonner';

interface Props {
  entityType: PlanSegment;
  entityId: string;
}

const STATUS_STYLES: Record<SubStatus, string> = {
  active:    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  trial:     'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  overdue:   'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400',
};

const PAY_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid:     'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300',
  pending:  'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300',
  failed:   'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400',
};

export default function SubscriptionSection({ entityType, entityId }: Props) {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['my-subscription', entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_subscriptions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .maybeSingle();
      if (error) throw error;
      return data as PlatformSubscription | null;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['my-payments', subscription?.id],
    enabled: !!subscription?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_payments')
        .select('*')
        .eq('subscription_id', subscription!.id)
        .order('created_at', { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as PlatformPayment[];
    },
  });

  if (isLoading) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>;
  }

  if (!subscription) {
    return (
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Assinatura</CardTitle>
          <CardDescription>Você ainda não tem uma assinatura ativa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Entre em contato com a equipe IACLIN para ativar seu plano.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const overdue = subscription.status === 'overdue';
  const dueDate = subscription.current_period_end || subscription.due_date;

  return (
    <div className="space-y-4">
      {overdue && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-4">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <strong>Assinatura em atraso.</strong> Regularize o pagamento para evitar o bloqueio do acesso.
          </div>
        </div>
      )}

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Assinatura
              </CardTitle>
              <CardDescription>Seu plano atual e histórico de pagamentos.</CardDescription>
            </div>
            <Badge variant="outline" className={STATUS_STYLES[subscription.status]}>
              {SUB_STATUS_LABELS[subscription.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Info label="Plano" value={subscription.plan_name ?? '—'} />
            <Info label="Ciclo" value={CYCLE_LABELS[subscription.billing_cycle]} />
            <Info label="Forma de pagamento" value={METHOD_LABELS[subscription.payment_method]} />
            <Info
              label="Valor"
              value={formatBRL(subscription.final_amount_cents || subscription.amount_cents)}
              hint={subscription.final_amount_cents !== subscription.amount_cents
                ? `Base ${formatBRL(subscription.amount_cents)}` : undefined}
            />
            <Info
              label="Próximo vencimento"
              value={dueDate ? format(new Date(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'}
            />
            <Info
              label="Último pagamento"
              value={subscription.last_payment_at
                ? format(new Date(subscription.last_payment_at), 'dd/MM/yyyy', { locale: ptBR })
                : '—'}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => toast.info('Para trocar de plano, entre em contato com a equipe IACLIN.')}
            >
              <Sparkles className="h-4 w-4" /> Trocar plano
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => toast.info('Pagamentos por cartão (Stripe) serão liberados em breve. Por enquanto utilize PIX manual com a equipe IACLIN.')}
            >
              <CreditCard className="h-4 w-4" /> Trocar forma de pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" /> Histórico de pagamentos
          </CardTitle>
          <CardDescription>Últimos {payments.length} lançamento{payments.length !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="divide-y">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatBRL(p.amount_cents)}</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method]}
                      {p.paid_at && ` · ${format(new Date(p.paid_at), 'dd/MM/yyyy', { locale: ptBR })}`}
                      {!p.paid_at && p.due_date && ` · Vence ${format(new Date(p.due_date), 'dd/MM/yyyy', { locale: ptBR })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.receipt_url && (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                        Comprovante
                      </a>
                    )}
                    <Badge variant="outline" className={PAY_STATUS_STYLES[p.status]}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}