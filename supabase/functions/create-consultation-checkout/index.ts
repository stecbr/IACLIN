import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineItem { name: string; amount: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { transaction_id?: string; patient_name?: string; line_items?: LineItem[] };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { transaction_id, patient_name, line_items } = body;
  if (!transaction_id || !Array.isArray(line_items) || line_items.length === 0) {
    return new Response(JSON.stringify({ error: 'transaction_id and line_items required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

  const origin = req.headers.get('origin') ?? 'https://iaclin.lovable.app';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: line_items.map((li) => ({
        quantity: 1,
        price_data: {
          currency: 'brl',
          product_data: { name: li.name.slice(0, 120) },
          unit_amount: Math.round((Number(li.amount) || 0) * 100),
        },
      })),
      metadata: {
        consultation_transaction_id: transaction_id,
        patient_name: patient_name ?? '',
      },
      success_url: `${origin}/financial?paid=1`,
      cancel_url: `${origin}/financial?canceled=1`,
    });

    return new Response(JSON.stringify({ url: session.url, id: session.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});