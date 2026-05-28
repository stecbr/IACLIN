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
    const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = String(claimsData.claims.email ?? '').toLowerCase();
    if (email !== 'iaclin@gmail.com') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body?.plan_id;
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
      .select('id, name, description, price_cents, billing_cycle, is_active, stripe_product_id, stripe_price_id')
      .eq('id', planId)
      .maybeSingle();
    if (planErr || !plan) throw new Error('Plan not found');

    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
    const interval = plan.billing_cycle === 'yearly' ? 'year' : 'month';

    // 1. Product
    let productId = plan.stripe_product_id as string | null;
    if (productId) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description ?? undefined,
        active: !!plan.is_active,
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description ?? undefined,
        active: !!plan.is_active,
        metadata: { plan_id: plan.id },
      });
      productId = product.id;
    }

    // 2. Price — immutable. Reuse if amount + interval still match.
    let priceId = plan.stripe_price_id as string | null;
    let priceChanged = false;

    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId);
        const matches =
          existing.unit_amount === plan.price_cents &&
          existing.currency === 'brl' &&
          existing.recurring?.interval === interval &&
          existing.product === productId &&
          existing.active;
        if (!matches) priceChanged = true;
      } catch {
        priceChanged = true;
      }
    } else {
      priceChanged = true;
    }

    if (priceChanged) {
      const newPrice = await stripe.prices.create({
        product: productId!,
        unit_amount: plan.price_cents,
        currency: 'brl',
        recurring: { interval },
        metadata: { plan_id: plan.id },
      });
      // archive old
      if (priceId) {
        try { await stripe.prices.update(priceId, { active: false }); } catch (_) { /* noop */ }
      }
      priceId = newPrice.id;
    }

    await admin
      .from('platform_plans')
      .update({ stripe_product_id: productId, stripe_price_id: priceId })
      .eq('id', plan.id);

    return new Response(JSON.stringify({
      ok: true,
      stripe_product_id: productId,
      stripe_price_id: priceId,
      price_changed: priceChanged,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('stripe-sync-plan error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});