import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code ?? '').toString().replace(/\D/g, '');
    if (code.length !== 6) {
      return new Response(JSON.stringify({ error: 'Código inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const nowIso = new Date().toISOString();
    const { data: share } = await admin
      .from('patient_chart_shares')
      .select('id, patient_id, clinic_id, created_by, expires_at')
      .eq('code', code)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (!share) {
      return new Response(JSON.stringify({ error: 'Código expirado ou inválido' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch patient + clinic + professional
    const [
      { data: patient },
      { data: clinic },
      { data: anamnese },
      { data: records },
      { data: odontogram },
      { data: mapEntries },
      { data: docs },
      { data: createdByProfile },
    ] = await Promise.all([
      admin.from('patients').select('*').eq('id', share.patient_id).maybeSingle(),
      share.clinic_id
        ? admin.from('clinics').select('name, phone, email, address, city, state, cnpj, logo_url')
            .eq('id', share.clinic_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('anamneses').select('*').eq('patient_id', share.patient_id)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('clinical_records')
        .select('*, clinical_record_procedures(*, procedures(name, code)), clinical_record_requests(*)')
        .eq('patient_id', share.patient_id)
        .order('created_at', { ascending: false }),
      admin.from('odontogram_entries').select('*').eq('patient_id', share.patient_id)
        .order('updated_at', { ascending: false }),
      admin.from('clinical_map_entries').select('*').eq('patient_id', share.patient_id)
        .order('updated_at', { ascending: false }),
      admin.from('documents').select('id, name, category, created_at').eq('patient_id', share.patient_id)
        .order('created_at', { ascending: false }),
      admin.from('profiles').select('full_name').eq('id', share.created_by).maybeSingle(),
    ]);

    // Resolve dentist names for records
    const dentistIds = Array.from(new Set((records ?? []).map((r: any) => r.dentist_id).filter(Boolean)));
    const dentistMap: Record<string, string> = {};
    if (dentistIds.length) {
      const { data: profs } = await admin.from('profiles').select('id, full_name').in('id', dentistIds);
      for (const p of profs ?? []) dentistMap[p.id] = p.full_name ?? '';
    }

    // Mark consumption
    await admin.from('patient_chart_shares').update({
      consumed_at: nowIso,
      consumed_count: 1,
    }).eq('id', share.id);

    return new Response(JSON.stringify({
      patient,
      clinic,
      anamnese,
      records: (records ?? []).map((r: any) => ({
        ...r,
        dentist_name: dentistMap[r.dentist_id] ?? null,
      })),
      odontogram: odontogram ?? [],
      map_entries: mapEntries ?? [],
      documents: docs ?? [],
      issued_by: createdByProfile?.full_name ?? null,
      issued_at: nowIso,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});