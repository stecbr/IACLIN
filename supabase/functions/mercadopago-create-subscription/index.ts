import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { mpFetch } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);

    const userId = String(claimsData.claims.sub);
    const userEmail = String(claimsData.claims.email ?? '');

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body?.plan_id;
    const entityType: 'clinic' | 'doctor' | 'operator' = body?.entity_type ?? 'doctor';
    const entityId: string = body?.entity_id ?? userId;
    const successUrl: string = body?.success_url ?? `${req.headers.get('origin') ?? ''}/settings?tab=subscription&status=success`;

    if (!planId) return json({ error: 'plan_id is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: plan, error: planErr } = await admin
      .from('platform_plans')
      .select('id, name, price_cents, billing_cycle, mp_preapproval_plan_id')
      .eq('id', planId)
      .maybeSingle();
    if (planErr || !plan) return json({ error: 'Plan not found' }, 404);
    if (!plan.mp_preapproval_plan_id) {
      return json({ error: 'Plano não está sincronizado com Mercado Pago. Peça ao admin para abrir o plano e salvar para sincronizar.' }, 400);
    }

    const frequency = plan.billing_cycle === 'yearly' ? 12 : 1;
    const amount = Number((plan.price_cents / 100).toFixed(2));

    const preapproval = await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        preapproval_plan_id: plan.mp_preapproval_plan_id,
        reason: plan.name,
        payer_email: userEmail,
        back_url: successUrl,
        external_reference: `${entityType}:${entityId}:${plan.id}`,
        auto_recurring: {
          frequency,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'BRL',
        },
        status: 'pending',
      }),
    });

    // Cria/atualiza registro local em status pending (não conta como active até o webhook)
    await admin
      .from('platform_subscriptions')
      .upsert({
        entity_type: entityType,
        entity_id: entityId,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: plan.billing_cycle,
        status: 'trial',
        payment_method: 'card',
        amount_cents: plan.price_cents,
        mp_preapproval_id: preapproval.id,
        mp_payer_email: userEmail,
        mp_init_point: preapproval.init_point,
      }, { onConflict: 'entity_type,entity_id' });

    return json({ url: preapproval.init_point, id: preapproval.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('mercadopago-create-subscription error:', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}