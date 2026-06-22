import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { requestId, reason } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: request } = await admin
      .from('appointment_requests')
      .select('clinic_id, status, appointment_id')
      .eq('id', requestId)
      .maybeSingle();

    if (!request) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Pedido já foi decidido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await admin
      .from('clinic_members')
      .select('id')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updErr } = await admin
      .from('appointment_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason ?? null,
        decided_at: new Date().toISOString(),
        decided_by: userId,
      })
      .eq('id', requestId);

    if (updErr) throw updErr;

    // Se já existia um appointment vinculado (ex.: aprovação revertida),
    // marca-o como cancelled para o hook do backend IA disparar a automação
    // de reagendamento via sync.
    if ((request as any).appointment_id) {
      await admin
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', (request as any).appointment_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[reject-appointment-request] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});