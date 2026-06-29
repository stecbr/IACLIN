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

    const body = await req.json().catch(() => ({}));
    const entityType: 'clinic' | 'doctor' | 'operator' = body?.entity_type ?? 'doctor';
    const entityId: string = body?.entity_id ?? userId;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authorization: for clinic entities, caller must be admin or owner of that clinic.
    // For doctor/operator entities, the entityId must match the authenticated user.
    if (entityType === 'clinic') {
      const { data: membership } = await admin
        .from('clinic_members')
        .select('id, is_owner, role')
        .eq('clinic_id', entityId)
        .eq('user_id', userId)
        .maybeSingle() as any;
      const isAdminOrOwner = membership && (membership.is_owner || membership.role === 'admin');
      if (!isAdminOrOwner) return json({ error: 'Forbidden' }, 403);
    } else if (entityId !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    const { data: sub } = await admin
      .from('platform_subscriptions')
      .select('id, mp_preapproval_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (!sub?.id) return json({ error: 'Nenhuma assinatura encontrada' }, 404);

    // Stop future billing at Mercado Pago (best-effort)
    if (sub.mp_preapproval_id) {
      try {
        await mpFetch(`/preapproval/${sub.mp_preapproval_id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'cancelled' }),
        });
      } catch (e) {
        console.warn('mp cancel failed (continuing soft-cancel):', e);
      }
    }

    // Soft cancel: keep access until current_period_end
    await admin
      .from('platform_subscriptions')
      .update({
        cancel_at_period_end: true,
        cancellation_requested_at: new Date().toISOString(),
        cancellation_reason: body?.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    return json({ ok: true, soft_cancel: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('mercadopago-cancel-subscription error:', msg);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}