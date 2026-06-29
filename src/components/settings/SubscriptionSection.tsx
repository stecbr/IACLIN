import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Receipt, Sparkles, CalendarClock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  formatBRL,
  SUB_STATUS_LABELS,
  CYCLE_LABELS,
  METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PlatformSubscription,
  type PlatformPayment,
  type PlanSegment,
  type PlatformPlan,
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
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data: subscription, isLoading, refetch: refetchSubscription } = useQuery({
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

  const { data: plans = [] } = useQuery({
    queryKey: ['available-plans', entityType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_plans')
        .select('*')
        .eq('segment', entityType)
        .eq('is_active', true)
        .order('price_cents', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlatformPlan[];
    },
  });

  const handleSubscribe = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-create-subscription', {
        body: {
          plan_id: planId,
          entity_type: entityType,
          entity_id: entityId,
          success_url: `${window.location.origin}/settings?tab=subscription&status=success`,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error('URL de checkout não retornada');
    } catch (e: any) {
      toast.error('Erro ao iniciar checkout: ' + (e?.message ?? 'desconhecido'));
      setCheckoutLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setPortalLoading(true);
    try {
      const { error } = await supabase.functions.invoke('mercadopago-cancel-subscription', {
        body: { entity_type: entityType, entity_id: entityId, reason: cancelReason || null },
      });
      if (error) throw error;
      toast.success('Cancelamento agendado. Você mantém acesso até o fim do período.');
      setCancelDialogOpen(false);
      setCancelReason('');
      await refetchSubscription();
    } catch (e: any) {
      toast.error('Erro ao cancelar: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleReactivate = async () => {
    setPortalLoading(true);
    try {
      const { error } = await (supabase as any).rpc('reactivate_subscription', {
        _entity_type: entityType,
        _entity_id: entityId,
      });
      if (error) throw error;
      toast.success('Assinatura reativada.');
      await refetchSubscription();
    } catch (e: any) {
      toast.error('Erro ao reativar: ' + (e?.message ?? 'desconhecido'));
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>;
  }

  const isActive = subscription && (subscription.status === 'active' || subscription.status === 'trial');

  const PlansGrid = () => (
    <Card className="shadow-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> {isActive ? 'Trocar de plano' : 'Escolha seu plano'}
        </CardTitle>
        <CardDescription>
          {isActive
            ? 'Mudanças entram em vigor no próximo ciclo de cobrança.'
            : 'Assine para liberar todos os recursos da plataforma.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum plano disponível no momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((p) => {
              const isCurrent = subscription?.plan_id === p.id && isActive;
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-5 flex flex-col gap-3 transition ${
                    isCurrent ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{CYCLE_LABELS[p.billing_cycle]}</p>
                    </div>
                    {isCurrent && <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">Atual</Badge>}
                  </div>
                  <div>
                    <span className="text-2xl font-semibold">{formatBRL(p.price_cents)}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      /{p.billing_cycle === 'yearly' ? 'ano' : 'mês'}
                    </span>
                  </div>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  {p.features && p.features.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {p.features.slice(0, 6).map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    className="mt-auto"
                    size="sm"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || checkoutLoading !== null}
                    onClick={() => handleSubscribe(p.id)}
                  >
                    {checkoutLoading === p.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecionando...</>
                    ) : isCurrent ? 'Plano atual' : isActive ? 'Trocar para este plano' : 'Assinar'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!subscription) {
    return (
      <div className="space-y-4">
        <Card className="shadow-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Assinatura</CardTitle>
            <CardDescription>Você ainda não tem uma assinatura ativa.</CardDescription>
          </CardHeader>
        </Card>
        <PlansGrid />
      </div>
    );
  }

  const overdue = subscription.status === 'overdue';
  const dueDate = subscription.current_period_end || subscription.due_date;
  const pendingCancellation = Boolean((subscription as any).cancel_at_period_end) && isActive;

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

      {pendingCancellation && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900 p-4">
          <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <strong>Cancelamento agendado.</strong>{' '}
            {dueDate
              ? <>Seu acesso permanece ativo até {format(new Date(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.</>
              : <>Seu acesso permanece ativo até o fim do período pago.</>}
          </div>
          <Button size="sm" variant="outline" onClick={handleReactivate} disabled={portalLoading}>
            Reativar assinatura
          </Button>
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
            {(subscription as any).mp_init_point && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                asChild
              >
                <a href={(subscription as any).mp_init_point} target="_blank" rel="noreferrer">
                  <CreditCard className="h-4 w-4" /> Atualizar cartão
                </a>
              </Button>
            )}
            {isActive && !pendingCancellation && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
                disabled={portalLoading}
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancelar assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A renovação automática será interrompida. Seu acesso ao IACLIN continua liberado
              {dueDate ? <> até <strong>{format(new Date(dueDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong></> : ' até o fim do período já pago'}.
              Após essa data, o sistema entra em modo restrito até a regularização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-muted-foreground">Motivo (opcional)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Conte-nos por que está cancelando..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={portalLoading}>Manter assinatura</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleCancelSubscription(); }}
              disabled={portalLoading}
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PlansGrid />

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