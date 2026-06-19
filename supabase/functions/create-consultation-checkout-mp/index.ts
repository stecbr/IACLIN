import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { mpFetch } from '../_shared/mercadopago.ts';

interface LineItem { name: string; amount: number }

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

    const body = await req.json().catch(() => ({}));
    const transaction_id: string | undefined = body?.transaction_id;
    const patient_name: string = body?.patient_name ?? '';
    const line_items: LineItem[] = Array.isArray(body?.line_items) ? body.line_items : [];
    if (!transaction_id || line_items.length === 0) {
      return json({ error: 'transaction_id and line_items required' }, 400);
    }

    const origin = req.headers.get('origin') ?? 'https://iaclin.lovable.app';
    const items = line_items.map((li) => ({
      title: String(li.name ?? 'Procedimento').slice(0, 120),
      quantity: 1,
      currency_id: 'BRL',
      unit_price: Number(li.amount) || 0,
    }));

    const preference = await mpFetch('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items,
        external_reference: `consultation:${transaction_id}`,
        metadata: { consultation_transaction_id: transaction_id, patient_name },
        back_urls: {
          success: `${origin}/financial?paid=1`,
          failure: `${origin}/financial?canceled=1`,
          pending: `${origin}/financial?pending=1`,
        },
        auto_return: 'approved',
      }),
    });

    return json({ url: preference.init_point, id: preference.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('create-consultation-checkout-mp error:', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}