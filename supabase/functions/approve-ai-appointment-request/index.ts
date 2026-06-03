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

    const { requestId, dentistId, startTime, endTime, durationMin } = await req.json();
    if (!requestId || !dentistId || !startTime) {
      return json({ error: 'requestId, dentistId e startTime são obrigatórios' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: request, error: reqErr } = await admin
      .from('ai_appointment_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();
    if (reqErr) throw reqErr;
    if (!request) return json({ error: 'Pedido não encontrado' }, 404);
    if (request.status !== 'pending') return json({ error: 'Pedido já foi decidido' }, 400);

    // Authorize: must be admin/secretary of clinic
    const { data: membership } = await admin
      .from('clinic_members')
      .select('id, role')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership || !['admin', 'secretary'].includes(membership.role)) {
      return json({ error: 'Sem permissão' }, 403);
    }

    // Verify the chosen dentist belongs to this clinic
    const { data: dentistMember } = await admin
      .from('clinic_members')
      .select('id, role')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', dentistId)
      .maybeSingle();
    if (!dentistMember || !['admin', 'dentist'].includes(dentistMember.role)) {
      return json({ error: 'Dentista inválido para esta clínica' }, 400);
    }

    // Resolve patient
    let patientId = request.patient_id as string | null;
    if (!patientId) {
      const phone = (request.patient_phone ?? '').trim();
      if (phone) {
        const { data: existing } = await admin
          .from('patients')
          .select('id')
          .eq('clinic_id', request.clinic_id)
          .eq('phone', phone)
          .maybeSingle();
        if (existing) patientId = existing.id;
      }
      if (!patientId) {
        const { data: created, error: cerr } = await admin
          .from('patients')
          .insert({
            clinic_id: request.clinic_id,
            full_name: request.patient_name ?? 'Paciente WhatsApp',
            phone: phone || null,
          })
          .select('id')
          .single();
        if (cerr) throw cerr;
        patientId = created.id;
      }
    }

    const start = new Date(startTime);
    const end = endTime
      ? new Date(endTime)
      : new Date(start.getTime() + (Number(durationMin) || 30) * 60_000);

    const { data: appt, error: apptErr } = await admin
      .from('appointments')
      .insert({
        patient_id: patientId,
        dentist_id: dentistId,
        clinic_id: request.clinic_id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled',
        label: request.specialty ?? request.procedure ?? null,
        notes: request.notes,
      })
      .select('id')
      .single();
    if (apptErr) throw apptErr;

    const { error: updErr } = await admin
      .from('ai_appointment_requests')
      .update({
        status: 'approved',
        appointment_id: appt.id,
        patient_id: patientId,
        decided_at: new Date().toISOString(),
        decided_by: userId,
      })
      .eq('id', requestId);
    if (updErr) throw updErr;

    return json({ success: true, appointmentId: appt.id, patientId });
  } catch (err) {
    console.error('[approve-ai-appointment-request] error', err);
    return json({ error: (err as Error).message }, 500);
  }
});