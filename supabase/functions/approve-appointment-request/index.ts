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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const { requestId, newStartTime, newEndTime } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'requestId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load request
    const { data: request, error: reqErr } = await admin
      .from('appointment_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (reqErr) throw reqErr;
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

    // Authorize: must be member of clinic
    const { data: membership } = await admin
      .from('clinic_members')
      .select('id, role')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = newStartTime ?? request.start_time;
    const endTime = newEndTime ?? request.end_time;
    const snapshot = request.patient_account_snapshot ?? {};

    // Find or create patient in this clinic
    let patientId: string | null = null;

    const { data: byUser } = await admin
      .from('patients')
      .select('id')
      .eq('clinic_id', request.clinic_id)
      .eq('patient_user_id', request.patient_user_id)
      .maybeSingle();

    if (byUser) {
      patientId = byUser.id;
    } else if (snapshot.cpf) {
      const { data: byCpf } = await admin
        .from('patients')
        .select('id')
        .eq('clinic_id', request.clinic_id)
        .eq('cpf', snapshot.cpf)
        .maybeSingle();
      if (byCpf) {
        patientId = byCpf.id;
        await admin.from('patients').update({ patient_user_id: request.patient_user_id }).eq('id', patientId);
      }
    }

    if (!patientId) {
      const { data: created, error: createErr } = await admin
        .from('patients')
        .insert({
          clinic_id: request.clinic_id,
          full_name: snapshot.full_name ?? 'Paciente',
          cpf: snapshot.cpf ?? null,
          phone: snapshot.phone ?? null,
          date_of_birth: snapshot.date_of_birth ?? null,
          insurance_provider: snapshot.insurance_provider ?? null,
          insurance_number: snapshot.insurance_number ?? null,
          patient_user_id: request.patient_user_id,
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      patientId = created.id;
    }

    // Create appointment
    const { data: appt, error: apptErr } = await admin
      .from('appointments')
      .insert({
        patient_id: patientId,
        dentist_id: request.dentist_id,
        clinic_id: request.clinic_id,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        label: request.specialty,
        notes: request.notes,
      })
      .select('id')
      .single();

    if (apptErr) throw apptErr;

    // Update request
    const { error: updErr } = await admin
      .from('appointment_requests')
      .update({
        status: 'approved',
        decided_at: new Date().toISOString(),
        decided_by: userId,
        appointment_id: appt.id,
        start_time: startTime,
        end_time: endTime,
      })
      .eq('id', requestId);

    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, appointmentId: appt.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[approve-appointment-request] error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});