import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function fmtHM(iso: string) {
  const d = new Date(iso);
  // Format in America/Sao_Paulo so the message matches what the user sees.
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });
  return fmt.format(d);
}

/** Returns the local YYYY-MM-DD for an ISO timestamp in America/Sao_Paulo */
function localDateKey(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  return fmt.format(d); // en-CA gives YYYY-MM-DD
}

/** UTC range covering the local Sao_Paulo day for a given timestamp. */
function localDayUtcRange(iso: string | Date): { startUtc: string; endUtc: string } {
  const ymd = localDateKey(iso);
  // Sao_Paulo is UTC-3 year-round (no DST).
  const startUtc = new Date(`${ymd}T00:00:00-03:00`).toISOString();
  const endUtc = new Date(new Date(`${ymd}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return { startUtc, endUtc };
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
      allowCompletedSameDay,
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

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Parallel initial lookups: patient account, dentist name, patient rows
    const [accountRes, dentistProfileRes, patientRowsRes] = await Promise.all([
      admin
        .from('patient_accounts')
        .select('full_name, cpf, phone, date_of_birth, insurance_provider, insurance_number')
        .eq('user_id', userId)
        .maybeSingle(),
      admin.from('profiles').select('full_name').eq('id', dentistId).maybeSingle(),
      admin.from('patients').select('id').eq('patient_user_id', userId),
    ]);

    if (accountRes.error) throw accountRes.error;
    const account = accountRes.data;
    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Cadastro de paciente incompleto. Atualize seu perfil.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const dentistName = (dentistProfileRes.data?.full_name as string) || 'profissional';
    const patientIds = (patientRowsRes.data ?? []).map((p: any) => p.id);

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

    const { startUtc: dayStartUtc, endUtc: dayEndUtc } = localDayUtcRange(start);
    const replaceGuard = replaceExistingId ?? '00000000-0000-0000-0000-000000000000';

    // Run all 6 conflict checks in parallel.
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const sameDoctorSameDayApptQ = patientIds.length > 0
      ? admin
          .from('appointments')
          .select('id, dentist_id, start_time, end_time, status')
          .in('patient_id', patientIds)
          .eq('dentist_id', dentistId)
          .gte('start_time', dayStartUtc)
          .lt('start_time', dayEndUtc)
          .neq('status', 'cancelled')
          .neq('id', replaceGuard)
          .order('start_time', { ascending: true })
      : Promise.resolve({ data: [] as any[] });

    const sameDoctorSameDayReqQ = admin
      .from('appointment_requests')
      .select('id, dentist_id, start_time, end_time')
      .eq('patient_user_id', userId)
      .eq('dentist_id', dentistId)
      .gte('start_time', dayStartUtc)
      .lt('start_time', dayEndUtc)
      .in('status', ['pending', 'approved'])
      .neq('id', replaceGuard)
      .limit(1);

    const doctorOverlapApptQ = admin
      .from('appointments')
      .select('id')
      .eq('dentist_id', dentistId)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .neq('status', 'cancelled')
      .neq('id', replaceGuard)
      .limit(1);

    const doctorOverlapReqQ = admin
      .from('appointment_requests')
      .select('id')
      .eq('dentist_id', dentistId)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .in('status', ['pending', 'approved'])
      .neq('id', replaceGuard)
      .limit(1);

    const patientOverlapApptQ = patientIds.length > 0
      ? admin
          .from('appointments')
          .select('id, dentist_id, start_time, end_time')
          .in('patient_id', patientIds)
          .lt('start_time', endIso)
          .gt('end_time', startIso)
          .neq('status', 'cancelled')
          .neq('id', replaceGuard)
          .limit(1)
      : Promise.resolve({ data: [] as any[] });

    const patientOverlapReqQ = admin
      .from('appointment_requests')
      .select('id, dentist_id, start_time, end_time')
      .eq('patient_user_id', userId)
      .lt('start_time', endIso)
      .gt('end_time', startIso)
      .in('status', ['pending', 'approved'])
      .neq('id', replaceGuard)
      .limit(1);

    const [
      sameDocDayAppt,
      sameDocDayReq,
      docOverlapAppt,
      docOverlapReq,
      patOverlapAppt,
      patOverlapReq,
    ] = await Promise.all([
      sameDoctorSameDayApptQ,
      sameDoctorSameDayReqQ,
      doctorOverlapApptQ,
      doctorOverlapReqQ,
      patientOverlapApptQ,
      patientOverlapReqQ,
    ]);

    // Evaluate in original priority order to preserve conflict messages.
    if (sameDocDayAppt.data && sameDocDayAppt.data.length > 0) {
      const c = sameDocDayAppt.data[0] as any;
      const isCompleted = c.status === 'completed';
      if (isCompleted && allowCompletedSameDay) {
        // user confirmed they want to book a return on the same day — skip this guard
      } else if (isCompleted) {
        return conflictJson({
          type: 'patient_completed_same_day' as any,
          message: `Você acabou de realizar uma consulta com Dr(a). ${dentistName} hoje às ${fmtHM(c.start_time)}. Deseja mesmo marcar um retorno agora?`,
          existing: {
            kind: 'appointment',
            id: c.id,
            dentistId: c.dentist_id,
            dentistName,
            startTime: c.start_time,
            endTime: c.end_time,
          },
        });
      } else {
      return conflictJson({
        type: 'patient_overlap_appointment',
        message: `Você já tem consulta com Dr(a). ${dentistName} neste dia, das ${fmtHM(c.start_time)} às ${fmtHM(c.end_time)}.`,
        existing: {
          kind: 'appointment',
          id: c.id,
          dentistId: c.dentist_id,
          dentistName,
          startTime: c.start_time,
          endTime: c.end_time,
        },
      });
      }
    }
    if (sameDocDayReq.data && sameDocDayReq.data.length > 0) {
      const c = sameDocDayReq.data[0] as any;
      return conflictJson({
        type: 'patient_overlap_request',
        message: `Você já tem um pedido com Dr(a). ${dentistName} neste dia, das ${fmtHM(c.start_time)} às ${fmtHM(c.end_time)}.`,
        existing: {
          kind: 'request',
          id: c.id,
          dentistId: c.dentist_id,
          dentistName,
          startTime: c.start_time,
          endTime: c.end_time,
        },
      });
    }
    if (docOverlapAppt.data && docOverlapAppt.data.length > 0) {
      return json(409, `Este horário não está mais disponível com Dr(a). ${dentistName}.`);
    }
    if (docOverlapReq.data && docOverlapReq.data.length > 0) {
      return json(409, `Já existe um pedido em conflito com Dr(a). ${dentistName} neste horário.`);
    }
    if (patOverlapAppt.data && patOverlapAppt.data.length > 0) {
      const c = patOverlapAppt.data[0] as any;
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
    if (patOverlapReq.data && patOverlapReq.data.length > 0) {
      const c = patOverlapReq.data[0] as any;
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
