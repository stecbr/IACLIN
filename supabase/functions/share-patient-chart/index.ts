import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function genCode(): string {
  // 6-digit numeric code, zero-padded
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const patientId = body?.patient_id as string | undefined;
    if (!patientId) {
      return new Response(JSON.stringify({ error: 'patient_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load patient to derive clinic
    const { data: patient, error: pErr } = await admin
      .from('patients').select('id, clinic_id').eq('id', patientId).maybeSingle();
    if (pErr || !patient) {
      return new Response(JSON.stringify({ error: 'Paciente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller belongs to the clinic (or is the same user when clinic_id null)
    if (patient.clinic_id) {
      const { data: belongs } = await admin
        .from('clinic_members')
        .select('id').eq('user_id', user.id).eq('clinic_id', patient.clinic_id).maybeSingle();
      if (!belongs) {
        return new Response(JSON.stringify({ error: 'Sem permissão para este paciente' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate unique code (retry a few times)
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = genCode();
      const { data: existing } = await admin
        .from('patient_chart_shares')
        .select('id')
        .eq('code', candidate)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (!existing) { code = candidate; break; }
    }
    if (!code) code = genCode();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: share, error: insErr } = await admin
      .from('patient_chart_shares')
      .insert({
        patient_id: patientId,
        clinic_id: patient.clinic_id,
        created_by: user.id,
        code,
        expires_at: expiresAt,
      })
      .select('id, code, expires_at')
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({
      code: share.code,
      expires_at: share.expires_at,
      share_id: share.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});