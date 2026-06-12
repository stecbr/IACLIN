import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

function cleanCpf(v: string | null | undefined) {
  return (v ?? '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const beneficiaryId = body?.beneficiary_id as string | undefined;
    if (!beneficiaryId) return new Response(JSON.stringify({ error: 'beneficiary_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: benef, error: bErr } = await admin
      .from('operator_beneficiaries')
      .select('id, operator_id, full_name, cpf, card_number')
      .eq('id', beneficiaryId)
      .maybeSingle();
    if (bErr || !benef) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // authorize: user must belong to operator
    const { data: belongs } = await admin.rpc('user_belongs_to_operator', { _user_id: user.id, _operator_id: benef.operator_id });
    if (!belongs) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: deps } = await admin
      .from('operator_beneficiary_dependents')
      .select('id, full_name, cpf, relationship')
      .eq('beneficiary_id', beneficiaryId);

    const members = [
      { id: benef.id, name: benef.full_name, role: 'titular' as const, cpf: cleanCpf(benef.cpf) },
      ...((deps ?? []).map((d) => ({ id: d.id, name: d.full_name, role: 'dependente' as const, cpf: cleanCpf(d.cpf), relationship: d.relationship }))),
    ];
    const cpfs = members.map((m) => m.cpf).filter((v) => v.length > 0);

    // approved credentialed clinics
    const { data: creds } = await admin
      .from('operator_credentialings')
      .select('clinic_id')
      .eq('operator_id', benef.operator_id)
      .eq('status', 'approved');
    const clinicIds = [...new Set((creds ?? []).map((c: any) => c.clinic_id))];

    let attendances: any[] = [];
    let summary = { total: 0, count: 0, avgTicket: 0, byMonth: [] as any[], topProcedures: [] as any[], topClinic: null as any, memberTotals: [] as any[] };

    if (cpfs.length > 0 && clinicIds.length > 0) {
      const { data: patientRows } = await admin
        .from('patients')
        .select('id, full_name, cpf, clinic_id')
        .in('cpf', cpfs)
        .in('clinic_id', clinicIds);
      const patients = (patientRows ?? []).map((p: any) => ({ ...p, cpfClean: cleanCpf(p.cpf) }));
      const patientIds = patients.map((p) => p.id);

      if (patientIds.length > 0) {
        const { data: appts } = await admin
          .from('appointments')
          .select('id, start_time, status, patient_id, dentist_id, clinic_id, procedure_id, procedures(name, code)')
          .in('patient_id', patientIds)
          .eq('status', 'completed')
          .order('start_time', { ascending: false });
        const apptRows = appts ?? [];

        // resolve price table: most recent active for operator
        const today = new Date().toISOString().slice(0, 10);
        const { data: tables } = await admin
          .from('operator_price_tables')
          .select('id, valid_from, valid_until')
          .eq('operator_id', benef.operator_id)
          .lte('valid_from', today)
          .order('valid_from', { ascending: false });
        const activeTable = (tables ?? []).find((t: any) => !t.valid_until || t.valid_until >= today) ?? (tables ?? [])[0];

        const priceMap = new Map<string, number>();
        if (activeTable) {
          const { data: items } = await admin
            .from('operator_price_items')
            .select('procedure_name, tuss_code, value_brl')
            .eq('table_id', activeTable.id);
          for (const it of (items ?? [])) {
            if (it.procedure_name) priceMap.set(`name:${it.procedure_name.toLowerCase().trim()}`, Number(it.value_brl ?? 0));
            if (it.tuss_code) priceMap.set(`code:${it.tuss_code}`, Number(it.value_brl ?? 0));
          }
        }

        const dentistIds = [...new Set(apptRows.map((a: any) => a.dentist_id))];
        const usedClinicIds = [...new Set(apptRows.map((a: any) => a.clinic_id).filter(Boolean))];
        const [{ data: profs }, { data: clinicsData }] = await Promise.all([
          dentistIds.length ? admin.from('profiles').select('id, full_name').in('id', dentistIds) : Promise.resolve({ data: [] as any[] }),
          usedClinicIds.length ? admin.from('clinics').select('id, name').in('id', usedClinicIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        const clinicMap = new Map((clinicsData ?? []).map((c: any) => [c.id, c.name]));
        const patientMap = new Map(patients.map((p) => [p.id, p]));

        attendances = apptRows.map((a: any) => {
          const p = patientMap.get(a.patient_id);
          const member = members.find((m) => m.cpf === p?.cpfClean);
          const procName = a.procedures?.name ?? null;
          const procCode = a.procedures?.code ?? null;
          let value: number | null = null;
          if (procCode && priceMap.has(`code:${procCode}`)) value = priceMap.get(`code:${procCode}`)!;
          else if (procName && priceMap.has(`name:${procName.toLowerCase().trim()}`)) value = priceMap.get(`name:${procName.toLowerCase().trim()}`)!;
          return {
            id: a.id,
            date: a.start_time,
            patient_name: p?.full_name ?? 'Paciente',
            member_name: member?.name ?? p?.full_name ?? 'Paciente',
            member_role: member?.role ?? 'titular',
            clinic_name: clinicMap.get(a.clinic_id) ?? 'Clínica',
            dentist_name: profMap.get(a.dentist_id) ?? 'Profissional',
            procedure: procName ?? '—',
            value,
          };
        });

        // aggregations
        const total = attendances.reduce((s, a) => s + (a.value ?? 0), 0);
        const count = attendances.length;
        const avgTicket = count > 0 ? total / count : 0;

        const monthMap: Record<string, number> = {};
        for (let i = 11; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          monthMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
        }
        attendances.forEach((a) => {
          const k = a.date.slice(0, 7);
          if (k in monthMap) monthMap[k] += a.value ?? 0;
        });
        const byMonth = Object.entries(monthMap).map(([k, v]) => ({ month: k, value: v }));

        const procCount: Record<string, { count: number; total: number }> = {};
        attendances.forEach((a) => {
          const k = a.procedure;
          if (!procCount[k]) procCount[k] = { count: 0, total: 0 };
          procCount[k].count++;
          procCount[k].total += a.value ?? 0;
        });
        const topProcedures = Object.entries(procCount)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const clinicCount: Record<string, { count: number; total: number }> = {};
        attendances.forEach((a) => {
          const k = a.clinic_name;
          if (!clinicCount[k]) clinicCount[k] = { count: 0, total: 0 };
          clinicCount[k].count++;
          clinicCount[k].total += a.value ?? 0;
        });
        const clinicList = Object.entries(clinicCount).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
        const topClinic = clinicList[0] ?? null;

        const memberTotals = members.map((m) => {
          const list = attendances.filter((a) => a.member_role === m.role && a.member_name === m.name);
          return { name: m.name, role: m.role, count: list.length, total: list.reduce((s, a) => s + (a.value ?? 0), 0) };
        });

        summary = { total, count, avgTicket, byMonth, topProcedures, topClinic, memberTotals };
      }
    }

    return new Response(JSON.stringify({ attendances, summary, members }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('operator-beneficiary-spend error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});