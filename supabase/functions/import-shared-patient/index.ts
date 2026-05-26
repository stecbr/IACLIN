import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const codeRaw = (body?.code ?? '').toString().replace(/\D/g, '');
    const targetClinicId = body?.clinic_id as string | null | undefined;

    if (codeRaw.length !== 6) {
      return new Response(JSON.stringify({ error: 'Código inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find share — accept consumed within the last 30 minutes so the redeem+import sequence works
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: share } = await admin
      .from('patient_chart_shares')
      .select('id, patient_id, source, created_at, expires_at')
      .eq('code', codeRaw)
      .eq('source', 'patient')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!share) {
      return new Response(JSON.stringify({ error: 'Código expirado ou inválido' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate clinic membership (or personal mode if null)
    if (targetClinicId) {
      const { data: belongs } = await admin
        .from('clinic_members')
        .select('id').eq('user_id', user.id).eq('clinic_id', targetClinicId).maybeSingle();
      if (!belongs) {
        return new Response(JSON.stringify({ error: 'Sem permissão para essa clínica' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Resolve anchor patient + all linked rows
    const { data: anchor } = await admin
      .from('patients').select('*').eq('id', share.patient_id).maybeSingle();
    if (!anchor) {
      return new Response(JSON.stringify({ error: 'Paciente não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const patientUserId = anchor.patient_user_id;
    let sourcePatientIds = [anchor.id];
    if (patientUserId) {
      const { data: linked } = await admin
        .from('patients').select('id').eq('patient_user_id', patientUserId);
      sourcePatientIds = Array.from(new Set([anchor.id, ...(linked ?? []).map((p: any) => p.id)]));
    }

    // Check if patient already exists for this clinic+user combo (to avoid dupes)
    let existing: any = null;
    if (patientUserId) {
      const q = admin.from('patients').select('id').eq('patient_user_id', patientUserId);
      const { data } = targetClinicId
        ? await q.eq('clinic_id', targetClinicId).maybeSingle()
        : await q.is('clinic_id', null).eq('dentist_id', user.id).maybeSingle();
      existing = data;
    }

    let newPatientId: string;
    if (existing) {
      newPatientId = existing.id;
    } else {
      const insertPayload: any = {
        full_name: anchor.full_name,
        cpf: anchor.cpf,
        phone: anchor.phone,
        email: anchor.email,
        date_of_birth: anchor.date_of_birth,
        gender: anchor.gender,
        address: anchor.address,
        city: anchor.city,
        state: anchor.state,
        zip_code: anchor.zip_code,
        insurance_provider: anchor.insurance_provider,
        insurance_number: anchor.insurance_number,
        photo_url: anchor.photo_url,
        notes: anchor.notes,
        patient_user_id: patientUserId,
        clinic_id: targetClinicId ?? null,
        dentist_id: targetClinicId ? null : user.id,
      };
      const { data: created, error: createErr } = await admin
        .from('patients').insert(insertPayload).select('id').single();
      if (createErr) throw createErr;
      newPatientId = created.id;
    }

    // Copy latest anamnesis
    const { data: anamnese } = await admin
      .from('anamneses').select('*').in('patient_id', sourcePatientIds)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (anamnese) {
      await admin.from('anamneses').insert({
        patient_id: newPatientId,
        clinic_id: targetClinicId ?? null,
        allergies: anamnese.allergies,
        medications: anamnese.medications,
        medical_conditions: anamnese.medical_conditions,
        habits: anamnese.habits,
        blood_type: anamnese.blood_type,
        notes: [anamnese.notes, '(Importado via compartilhamento do paciente)'].filter(Boolean).join('\n\n'),
        filled_by: user.id,
      });
    }

    // Copy clinical records (+ children)
    const { data: records } = await admin
      .from('clinical_records')
      .select('*, clinical_record_procedures(*), clinical_record_requests(*)')
      .in('patient_id', sourcePatientIds)
      .order('created_at', { ascending: false });
    for (const r of records ?? []) {
      const { data: newRec, error: recErr } = await admin
        .from('clinical_records').insert({
          patient_id: newPatientId,
          clinic_id: targetClinicId ?? null,
          dentist_id: user.id,
          status: 'completed',
          chief_complaint: r.chief_complaint,
          history_present_illness: r.history_present_illness,
          physical_exam: r.physical_exam,
          diagnosis: r.diagnosis,
          treatment_plan: r.treatment_plan,
          notes: [r.notes, '(Importado de outra clínica via compartilhamento do paciente)'].filter(Boolean).join('\n\n'),
          symptom_duration: r.symptom_duration,
          severity: r.severity,
          hypotheses: r.hypotheses,
          vital_signs: r.vital_signs,
          follow_up_reason: r.follow_up_reason,
          follow_up_date: r.follow_up_date,
          procedure_duration_seconds: r.procedure_duration_seconds,
        }).select('id').single();
      if (recErr || !newRec) continue;
      const procs = (r as any).clinical_record_procedures ?? [];
      if (procs.length) {
        await admin.from('clinical_record_procedures').insert(
          procs.map((p: any) => ({
            clinical_record_id: newRec.id,
            procedure_id: p.procedure_id,
            tooth_number: p.tooth_number,
            surface: p.surface,
            notes: p.notes,
            price: p.price ?? 0,
          }))
        );
      }
      const reqs = (r as any).clinical_record_requests ?? [];
      if (reqs.length) {
        await admin.from('clinical_record_requests').insert(
          reqs.map((q: any) => ({
            clinical_record_id: newRec.id,
            kind: q.kind,
            payload: q.payload ?? {},
          }))
        );
      }
    }

    // Copy odontogram entries
    const { data: odonto } = await admin
      .from('odontogram_entries').select('*').in('patient_id', sourcePatientIds);
    if (odonto?.length) {
      await admin.from('odontogram_entries').insert(
        odonto.map((o: any) => ({
          patient_id: newPatientId,
          dentist_id: user.id,
          tooth_number: o.tooth_number,
          surface: o.surface,
          condition: o.condition,
          notes: o.notes,
          procedure_id: o.procedure_id,
        }))
      );
    }

    // Copy clinical map entries
    const { data: mapEntries } = await admin
      .from('clinical_map_entries').select('*').in('patient_id', sourcePatientIds);
    if (mapEntries?.length) {
      await admin.from('clinical_map_entries').insert(
        mapEntries.map((m: any) => ({
          patient_id: newPatientId,
          clinic_id: targetClinicId ?? null,
          dentist_id: user.id,
          map_type: m.map_type,
          region_code: m.region_code,
          condition: m.condition,
          severity: m.severity,
          notes: m.notes,
          payload: m.payload ?? {},
        }))
      );
    }

    // Copy documents (reference same file_url)
    const { data: docs } = await admin
      .from('documents').select('*').in('patient_id', sourcePatientIds);
    if (docs?.length) {
      await admin.from('documents').insert(
        docs.map((d: any) => ({
          patient_id: newPatientId,
          name: d.name,
          category: d.category ?? 'compartilhado',
          file_type: d.file_type,
          file_url: d.file_url,
          uploaded_by: user.id,
        }))
      );
    }

    // Mark share consumed
    await admin.from('patient_chart_shares').update({
      consumed_at: new Date().toISOString(),
      consumed_count: 1,
    }).eq('id', share.id);

    return new Response(JSON.stringify({ patient_id: newPatientId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});