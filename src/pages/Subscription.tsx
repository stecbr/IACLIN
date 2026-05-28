import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  billing_cycle: 'monthly' | 'yearly';
  price_cents: number;
  stripe_price_id: string | null;
};

type Sub = {
  id: string;
  status: string;
  plan_id: string | null;
  plan_name: string | null;
  current_period_end: string | null;
  billing_cycle: string;
};

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Subscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const status = params.get('status');
    if (status === 'success') {
      toast.success('Pagamento confirmado! Sua assinatura está sendo ativada.');
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      setParams({}, { replace: true });
    } else if (status === 'cancelled') {
      toast.info('Checkout cancelado.');
      setParams({}, { replace: true });
    }
  }, [params, qc, setParams]);

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['active-plans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_plans')
        .select('id, name, description, billing_cycle, price_cents, stripe_price_id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const { data: mySub } = useQuery({
    queryKey: ['my-subscription', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('platform_subscriptions')
        .select('id, status, plan_id, plan_name, current_period_end, billing_cycle')
        .eq('entity_type', 'doctor')
        .eq('entity_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Sub | null;
    },
  });

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        body: { plan_id: planId, entity_type: 'doctor', entity_id: user?.id },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error('Erro ao iniciar checkout: ' + (e?.message ?? 'desconhecido'));
    } finally { setLoadingPlan(null); }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-customer-portal', {
        body: { entity_type: 'doctor', entity_id: user?.id },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error('Erro ao abrir portal: ' + (e?.message ?? 'desconhecido'));
    } finally { setPortalLoading(false); }
  };

  const activeStatus = mySub && ['active', 'trial'].includes(mySub.status);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Assinatura</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um plano para liberar todos os recursos da plataforma.
        </p>
      </div>

      {mySub && (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{mySub.plan_name ?? 'Plano atual'}</span>
              <Badge variant={activeStatus ? 'default' : 'secondary'}>
                {mySub.status === 'active' ? 'Ativa' :
                 mySub.status === 'trial' ? 'Em trial' :
                 mySub.status === 'overdue' ? 'Inadimplente' :
                 mySub.status === 'cancelled' ? 'Cancelada' : mySub.status}
              </Badge>
            </div>
            {mySub.current_period_end && (
              <p className="text-xs text-muted-foreground">
                Próxima renovação: {new Date(mySub.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerenciar assinatura'}
          </Button>
        </Card>
      )}

      {loadingPlans ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-56 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum plano disponível. Aguarde — em breve os planos estarão configurados.
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrent = mySub?.plan_id === plan.id && activeStatus;
            const isAnnual = plan.billing_cycle === 'yearly';
            return (
              <Card key={plan.id} className={`p-6 relative ${isAnnual ? 'border-primary/40' : ''}`}>
                {isAnnual && (
                  <Badge className="absolute top-4 right-4 gap-1">
                    <Sparkles className="h-3 w-3" /> Melhor valor
                  </Badge>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                )}
                <div className="mt-4">
                  <span className="text-3xl font-bold">{formatBRL(plan.price_cents)}</span>
                  <span className="text-sm text-muted-foreground ml-1">
                    /{plan.billing_cycle === 'yearly' ? 'ano' : 'mês'}
                  </span>
                </div>
                <ul className="space-y-2 mt-5 text-sm">
                  {['Agenda inteligente', 'Prontuário eletrônico', 'Financeiro completo',
                    'Marketplace de pacientes', isAnnual ? '2 meses grátis vs. mensal' : 'Cobrança mensal'].map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6"
                  disabled={isCurrent || loadingPlan === plan.id || !plan.stripe_price_id}
                  onClick={() => handleSubscribe(plan.id)}
                  variant={isAnnual ? 'default' : 'outline'}
                >
                  {loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    isCurrent ? 'Plano atual' :
                    !plan.stripe_price_id ? 'Indisponível' : 'Assinar'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Pagamento processado com segurança pelo Stripe. Em modo de teste, use o cartão{' '}
        <code className="font-mono">4242 4242 4242 4242</code>.
      </p>
    </div>
  );
}