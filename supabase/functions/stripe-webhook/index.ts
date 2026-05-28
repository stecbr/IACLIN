import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !whSecret) {
    return new Response('Stripe not configured', { status: 500, headers: corsHeaders });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400, headers: corsHeaders });

  const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, whSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const md = session.metadata ?? {};
        const planId = md.plan_id;
        const entityType = md.entity_type;
        const entityId = md.entity_id;
        if (!planId || !entityType || !entityId) break;

        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;

        let sub: Stripe.Subscription | null = null;
        if (subId) sub = await stripe.subscriptions.retrieve(subId);

        const { data: plan } = await admin
          .from('platform_plans')
          .select('name, billing_cycle, price_cents')
          .eq('id', planId).maybeSingle();

        const periodEnd = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10)
          : null;

        await admin.rpc('upsert_platform_subscription', {
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_plan_id: planId,
          p_billing_cycle: plan?.billing_cycle ?? 'monthly',
          p_status: 'active',
          p_payment_method: 'card',
        }).then(() => null).catch((e) => console.error('rpc upsert failed (continuing):', e));

        await admin.from('platform_subscriptions').update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
          current_period_end: periodEnd,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('entity_type', entityType).eq('entity_id', entityId);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;

        const { data: subRow } = await admin
          .from('platform_subscriptions')
          .select('id, billing_cycle')
          .eq('stripe_subscription_id', subscriptionId).maybeSingle();
        if (!subRow) break;

        await admin.from('platform_payments').insert({
          subscription_id: subRow.id,
          amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
          method: 'card',
          status: 'paid',
          paid_at: new Date((invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          stripe_invoice_id: invoice.id,
          receipt_url: invoice.hosted_invoice_url ?? null,
        });
        // trigger tg_payment_extend_period will move current_period_end + status active
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;
        await admin.from('platform_subscriptions')
          .update({ status: 'overdue', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscriptionId);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString().slice(0, 10) : null;
        let status: string = 'active';
        if (sub.status === 'canceled' || sub.status === 'unpaid') status = 'cancelled';
        else if (sub.status === 'past_due') status = 'overdue';
        else if (sub.status === 'trialing') status = 'trial';
        else if (sub.status === 'active') status = 'active';

        await admin.from('platform_subscriptions').update({
          status, current_period_end: periodEnd, updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('stripe-webhook handler error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});