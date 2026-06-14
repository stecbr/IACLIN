import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeCpf(v: string) { return (v || '').replace(/\D/g, ''); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const cpf = normalizeCpf(body.cpf || '');
    const clinic_id = body.clinic_id || null;
    const mode = body.mode || 'create'; // 'check' or 'create'

    if (cpf.length !== 11) return json({ error: 'invalid_cpf' }, 400);

    const { data: account } = await admin
      .from('patient_accounts')
      .select('user_id, full_name')
      .eq('cpf', cpf)
      .maybeSingle();

    if (!account) {
      return json({ exists: false });
    }

    if (mode === 'check') {
      return json({ exists: true });
    }

    // If a patients row already exists in this clinic with this CPF AND is linked to this account, return already_linked
    if (clinic_id) {
      const { data: existing } = await admin
        .from('patients')
        .select('id, patient_user_id')
        .eq('clinic_id', clinic_id)
        .eq('cpf', cpf)
        .maybeSingle();
      if (existing?.patient_user_id === account.user_id) {
        return json({ exists: true, already_linked: true });
      }
    }

    // Reuse pending request if exists
    const { data: existingReq } = await admin
      .from('patient_link_requests')
      .select('id, status, expires_at')
      .eq('requested_by_user_id', user.id)
      .eq('patient_user_id', account.user_id)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingReq) {
      return json({ exists: true, request_id: existingReq.id, already_pending: true });
    }

    const { data: created, error } = await admin
      .from('patient_link_requests')
      .insert({
        requested_by_user_id: user.id,
        clinic_id,
        patient_user_id: account.user_id,
        cpf,
      })
      .select('id')
      .single();
    if (error) throw error;

    // Profile of requester
    const { data: requesterProfile } = await admin
      .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    let clinicName: string | null = null;
    if (clinic_id) {
      const { data: c } = await admin.from('clinics').select('name').eq('id', clinic_id).maybeSingle();
      clinicName = c?.name ?? null;
    }
    const who = clinicName || requesterProfile?.full_name || 'Um profissional';

    // In-app notification for patient
    await admin.from('notifications').insert({
      clinic_id,
      user_id: account.user_id,
      type: 'patient_link_request',
      title: 'Nova solicitação de vinculação',
      message: `${who} deseja adicionar você à lista de pacientes.`,
      reference_id: created.id,
      reference_type: 'patient_link_request',
    });

    return json({ exists: true, request_id: created.id });
  } catch (e) {
    console.error('request-patient-link', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}