import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Invalid token' }, 401);
    const userId = userData.user.id;

    const { requestId, reason } = await req.json();
    if (!requestId) return json({ error: 'requestId é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: request } = await admin
      .from('ai_appointment_requests')
      .select('clinic_id, status')
      .eq('id', requestId)
      .maybeSingle();
    if (!request) return json({ error: 'Pedido não encontrado' }, 404);
    if (request.status !== 'pending') return json({ error: 'Pedido já foi decidido' }, 400);

    const { data: membership } = await admin
      .from('clinic_members')
      .select('id, role')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership || !['admin', 'secretary'].includes(membership.role)) {
      return json({ error: 'Sem permissão' }, 403);
    }

    const { error: updErr } = await admin
      .from('ai_appointment_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason ?? null,
        decided_at: new Date().toISOString(),
        decided_by: userId,
      })
      .eq('id', requestId);
    if (updErr) throw updErr;

    return json({ success: true });
  } catch (err) {
    console.error('[reject-ai-appointment-request] error', err);
    return json({ error: (err as Error).message }, 500);
  }
});