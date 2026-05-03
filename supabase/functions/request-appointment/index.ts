import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtHM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

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
      { global: { headers: { Authorization: authHeader } } },
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
    const {
      clinicId,
      dentistId,
      specialty,
      startTime,
      endTime,
      notes,
      replaceExistingId,
      replaceKind,
    } = body ?? {};

    if (!clinicId || !dentistId || !startTime || !endTime) {
      return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Patient account
    const { data: account, error: accErr } = await admin
      .from('patient_accounts')
      .select('full_name, cpf, phone, date_of_birth, insurance_provider, insurance_number')
      .eq('user_id', userId)
      .maybeSingle();

    if (accErr) throw accErr;
    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Cadastro de paciente incompleto. Atualize seu perfil.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Resolve dentist name (used in messages)
    const { data: dentistProfile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', dentistId)
      .maybeSingle();
    const dentistName = (dentistProfile?.full_name as string) || 'profissional';

    const start = new Date(startTime);
    const end = new Date(endTime);

    const json = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    const conflictJson = (payload: {
      type: 'patient_overlap_appointment' | 'patient_overlap_request';
      message: string;
      existing: {
        kind: 'appointment' | 'request';
        id: string;
        dentistId: string;
        dentistName: string;
        startTime: string;
        endTime: string;
      };
    }) =>
      new Response(JSON.stringify({ conflict: true, ...payload }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    // If client confirmed a replacement, cancel the old record first (with ownership check).
    if (replaceExistingId && (replaceKind === 'appointment' || replaceKind === 'request')) {
      if (replaceKind === 'appointment') {
        // Validate the appointment belongs to a patient row owned by this user
        const { data: appt } = await admin
          .from('appointments')
          .select('id, patient_id')
          .eq('id', replaceExistingId)
          .maybeSingle();
        if (appt) {
          const { data: pat } = await admin
            .from('patients')
            .select('id')
            .eq('id', appt.patient_id)
            .eq('patient_user_id', userId)
            .maybeSingle();
          if (pat) {
            await admin
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', replaceExistingId);
          }
        }
      } else {
        await admin
          .from('appointment_requests')
          .update({ status: 'cancelled' })
          .eq('id', replaceExistingId)
          .eq('patient_user_id', userId);
      }
    }

    // a) Doctor overlap in appointments
    {
      const { data } = await admin
        .from('appointments')
        .select('id')
        .eq('dentist_id', dentistId)
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString())
        .neq('status', 'cancelled')
        .neq('id', replaceExistingId ?? '00000000-0000-0000-0000-000000000000')
        .limit(1);
      if (data && data.length > 0) {
        return json(409, `Este horário não está mais disponível com Dr(a). ${dentistName}.`);
      }
    }

    // b) Doctor overlap in pending/approved requests
    {
      const { data } = await admin
        .from('appointment_requests')
        .select('id')
        .eq('dentist_id', dentistId)
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString())
        .in('status', ['pending', 'approved'])
        .neq('id', replaceExistingId ?? '00000000-0000-0000-0000-000000000000')
        .limit(1);
      if (data && data.length > 0) {
        return json(409, `Já existe um pedido em conflito com Dr(a). ${dentistName} neste horário.`);
      }
    }

    // Resolve patient_id rows linked to this user (via patient_user_id)
    const { data: patientRows } = await admin
      .from('patients')
      .select('id')
      .eq('patient_user_id', userId);
    const patientIds = (patientRows ?? []).map((p: any) => p.id);

    // c) Patient time overlap (any doctor) — return structured conflict so UI can offer reschedule
    if (patientIds.length > 0) {
      const { data } = await admin
        .from('appointments')
        .select('id, dentist_id, start_time, end_time')
        .in('patient_id', patientIds)
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString())
        .neq('status', 'cancelled')
        .neq('id', replaceExistingId ?? '00000000-0000-0000-0000-000000000000')
        .limit(1);
      if (data && data.length > 0) {
        const c = data[0] as any;
        const { data: dp } = await admin.from('profiles').select('full_name').eq('id', c.dentist_id).maybeSingle();
        const name = (dp?.full_name as string) || 'outro profissional';
        return conflictJson({
          type: 'patient_overlap_appointment',
          message: `Você já tem consulta com Dr(a). ${name} das ${fmtHM(c.start_time)} às ${fmtHM(c.end_time)}.`,
          existing: {
            kind: 'appointment',
            id: c.id,
            dentistId: c.dentist_id,
            dentistName: name,
            startTime: c.start_time,
            endTime: c.end_time,
          },
        });
      }
    }
    {
      const { data } = await admin
        .from('appointment_requests')
        .select('id, dentist_id, start_time, end_time')
        .eq('patient_user_id', userId)
        .lt('start_time', end.toISOString())
        .gt('end_time', start.toISOString())
        .in('status', ['pending', 'approved'])
        .neq('id', replaceExistingId ?? '00000000-0000-0000-0000-000000000000')
        .limit(1);
      if (data && data.length > 0) {
        const c = data[0] as any;
        const { data: dp } = await admin.from('profiles').select('full_name').eq('id', c.dentist_id).maybeSingle();
        const name = (dp?.full_name as string) || 'outro profissional';
        return conflictJson({
          type: 'patient_overlap_request',
          message: `Você já tem um pedido com Dr(a). ${name} das ${fmtHM(c.start_time)} às ${fmtHM(c.end_time)}.`,
          existing: {
            kind: 'request',
            id: c.id,
            dentistId: c.dentist_id,
            dentistName: name,
            startTime: c.start_time,
            endTime: c.end_time,
          },
        });
      }
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
