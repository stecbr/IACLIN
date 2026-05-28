import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = String(claimsData.claims.sub);
    const userEmail = String(claimsData.claims.email ?? '');

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body?.plan_id;
    const entityType: 'clinic' | 'doctor' | 'operator' = body?.entity_type ?? 'doctor';
    const entityId: string = body?.entity_id ?? userId;
    const successUrl: string = body?.success_url ?? `${req.headers.get('origin') ?? ''}/assinatura?status=success`;
    const cancelUrl: string = body?.cancel_url ?? `${req.headers.get('origin') ?? ''}/assinatura?status=cancelled`;

    if (!planId) {
      return new Response(JSON.stringify({ error: 'plan_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: plan, error: planErr } = await admin
      .from('platform_plans')
      .select('id, name, stripe_price_id, billing_cycle')
      .eq('id', planId)
      .maybeSingle();
    if (planErr || !plan?.stripe_price_id) {
      return new Response(JSON.stringify({ error: 'Plan not found or missing Stripe price' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });

    // Reuse Stripe customer if subscription already exists for this entity
    const { data: existingSub } = await admin
      .from('platform_subscriptions')
      .select('id, stripe_customer_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id ?? null;
    if (!customerId) {
      // Try to find by email first
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      customerId = existing.data[0]?.id ?? null;
      if (!customerId) {
        const c = await stripe.customers.create({
          email: userEmail,
          metadata: { user_id: userId, entity_type: entityType, entity_id: entityId },
        });
        customerId = c.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        plan_id: plan.id,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          plan_id: plan.id,
          entity_type: entityType,
          entity_id: entityId,
          user_id: userId,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('stripe-create-checkout error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});