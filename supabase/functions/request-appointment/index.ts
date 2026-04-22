import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { clinicId, dentistId, specialty, startTime, endTime, notes } = body ?? {};

    if (!clinicId || !dentistId || !startTime || !endTime) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load patient account
    const { data: account, error: accErr } = await admin
      .from('patient_accounts')
      .select('full_name, cpf, phone, date_of_birth, insurance_provider, insurance_number')
      .eq('user_id', userId)
      .maybeSingle();

    if (accErr) throw accErr;
    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Cadastro de paciente incompleto. Atualize seu perfil.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check slot availability — block if there's an approved appointment or pending/approved request
    const { data: existingAppt } = await admin
      .from('appointments')
      .select('id')
      .eq('dentist_id', dentistId)
      .eq('start_time', startTime)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingAppt) {
      return new Response(
        JSON.stringify({ error: 'Este horário acabou de ser ocupado. Escolha outro.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingReq } = await admin
      .from('appointment_requests')
      .select('id')
      .eq('dentist_id', dentistId)
      .eq('start_time', startTime)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (existingReq) {
      return new Response(
        JSON.stringify({ error: 'Já existe um pedido para este horário.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: created, error: insErr } = await admin
      .from('appointment_requests')
      .insert({
        patient_user_id: userId,
        patient_account_snapshot: account,
        clinic_id: clinicId,
        dentist_id: dentistId,
        specialty: specialty ?? null,
        start_time: startTime,
        end_time: endTime,
        notes: notes ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, requestId: created.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[request-appointment] error', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});