import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { mpFetch } from '../_shared/mercadopago.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supa.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401);
    if (String(claimsData.claims.email ?? '').toLowerCase() !== 'iaclin@gmail.com') {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const planId: string | undefined = body?.plan_id;
    if (!planId) return json({ error: 'plan_id is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: plan, error: planErr } = await admin
      .from('platform_plans')
      .select('id, name, description, price_cents, billing_cycle, is_active, mp_preapproval_plan_id')
      .eq('id', planId)
      .maybeSingle();
    if (planErr || !plan) return json({ error: 'Plan not found' }, 404);

    const frequency = plan.billing_cycle === 'yearly' ? 12 : 1;
    const reason = plan.name;
    const amount = Number((plan.price_cents / 100).toFixed(2));
    const back_url = `${req.headers.get('origin') ?? 'https://iaclin.lovable.app'}/settings?tab=subscription&status=success`;

    const auto_recurring = {
      frequency,
      frequency_type: 'months',
      transaction_amount: amount,
      currency_id: 'BRL',
    };

    let mpPlan: any;
    if (plan.mp_preapproval_plan_id) {
      mpPlan = await mpFetch(`/preapproval_plan/${plan.mp_preapproval_plan_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          reason, auto_recurring, back_url,
          status: plan.is_active ? 'active' : 'cancelled',
        }),
      });
    } else {
      mpPlan = await mpFetch(`/preapproval_plan`, {
        method: 'POST',
        body: JSON.stringify({ reason, auto_recurring, back_url, payment_methods_allowed: { payment_types: [{ id: 'credit_card' }] } }),
      });
      await admin
        .from('platform_plans')
        .update({ mp_preapproval_plan_id: mpPlan.id })
        .eq('id', plan.id);
    }

    return json({ ok: true, mp_preapproval_plan_id: mpPlan.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('mercadopago-sync-plan error:', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}