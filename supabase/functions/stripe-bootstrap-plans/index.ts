import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PLANS = [
  {
    name: 'IACLIN Mensal (Teste)',
    description: 'Plano de teste mensal — validação do fluxo de cobrança.',
    billing_cycle: 'monthly' as const,
    interval: 'month' as const,
    price_cents: 9999,
    sort_order: 1,
  },
  {
    name: 'IACLIN Anual (Teste)',
    description: 'Plano de teste anual — validação do fluxo de cobrança.',
    billing_cycle: 'yearly' as const,
    interval: 'year' as const,
    price_cents: 85999,
    sort_order: 2,
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');

    // Require platform admin
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
    const email = String(claimsData.claims.email ?? '').toLowerCase();
    if (email !== 'iaclin@gmail.com') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(secret, { apiVersion: '2024-12-18.acacia' });
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const results: Array<{ name: string; product: string; price: string; plan_id: string }> = [];

    for (const p of PLANS) {
      // Find existing plan by name + cycle to avoid duplicates
      const { data: existing } = await admin
        .from('platform_plans')
        .select('id, stripe_product_id, stripe_price_id')
        .eq('name', p.name)
        .eq('billing_cycle', p.billing_cycle)
        .maybeSingle();

      let productId = existing?.stripe_product_id ?? null;
      if (!productId) {
        const prod = await stripe.products.create({ name: p.name, description: p.description ?? undefined });
        productId = prod.id;
      }

      // Create new price (Stripe prices are immutable; safe to create fresh on bootstrap)
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: p.price_cents,
        currency: 'brl',
        recurring: { interval: p.interval },
      });

      if (existing) {
        await admin.from('platform_plans').update({
          description: p.description,
          price_cents: p.price_cents,
          stripe_product_id: productId,
          stripe_price_id: price.id,
          is_active: true,
          sort_order: p.sort_order,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        results.push({ name: p.name, product: productId, price: price.id, plan_id: existing.id });
      } else {
        const { data: ins, error: insErr } = await admin.from('platform_plans').insert({
          name: p.name,
          description: p.description,
          segment: 'clinic',
          billing_cycle: p.billing_cycle,
          price_cents: p.price_cents,
          currency: 'BRL',
          features: [],
          stripe_product_id: productId,
          stripe_price_id: price.id,
          is_active: true,
          sort_order: p.sort_order,
        }).select('id').single();
        if (insErr) throw insErr;
        results.push({ name: p.name, product: productId, price: price.id, plan_id: ins!.id });
      }
    }

    return new Response(JSON.stringify({ ok: true, plans: results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('stripe-bootstrap-plans error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});