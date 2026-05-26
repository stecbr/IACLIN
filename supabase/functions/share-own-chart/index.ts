import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function genCode(): string {
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
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
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find an anchor patients row linked to this account (any clinic)
    const { data: anchor } = await admin
      .from('patients')
      .select('id')
      .eq('patient_user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let anchorId = anchor?.id as string | undefined;

    // Fallback: create a personal patient row from patient_accounts if none exists
    if (!anchorId) {
      const { data: account } = await admin
        .from('patient_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!account) {
        return new Response(JSON.stringify({ error: 'Cadastro de paciente não encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: created, error: createErr } = await admin
        .from('patients')
        .insert({
          full_name: account.full_name,
          cpf: account.cpf,
          phone: account.phone,
          date_of_birth: account.date_of_birth,
          insurance_provider: account.insurance_provider,
          insurance_number: account.insurance_number,
          patient_user_id: user.id,
          clinic_id: null,
          dentist_id: null,
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      anchorId = created.id;
    }

    // Generate unique code
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
        patient_id: anchorId,
        clinic_id: null,
        created_by: user.id,
        code,
        expires_at: expiresAt,
        source: 'patient',
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