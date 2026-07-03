import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function pagination(url: URL) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  return { limit, offset };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  try {
    const apiKey = req.headers.get('x-api-key') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!apiKey) return json({ error: 'missing api key: send it in the x-api-key header' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const keyHash = await sha256Hex(apiKey);

    const { data: keyRow } = await admin
      .from('operator_api_keys')
      .select('id, operator_id, revoked_at')
      .eq('key_hash', keyHash)
      .maybeSingle();

    if (!keyRow || keyRow.revoked_at) return json({ error: 'invalid or revoked api key' }, 401);

    admin.from('operator_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then();

    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') ?? '';
    const operatorId = keyRow.operator_id;

    if (resource === 'ping') {
      const { data: op } = await admin.from('insurance_operators').select('id, name').eq('id', operatorId).maybeSingle();
      return json({ ok: true, operator: op });
    }

    if (resource === 'network') {
      const { limit, offset } = pagination(url);
      const { data: creds, error, count } = await admin
        .from('operator_credentialings')
        .select('id, clinic_id, professional_user_id, status, decided_at, requested_at', { count: 'exact' })
        .eq('operator_id', operatorId)
        .eq('status', 'approved')
        .order('decided_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);

      const clinicIds = [...new Set((creds ?? []).map((c: any) => c.clinic_id))];
      const profIds = [...new Set((creds ?? []).map((c: any) => c.professional_user_id))];
      const [{ data: clinics }, { data: profs }] = await Promise.all([
        clinicIds.length ? admin.from('clinics').select('id, name, city, state, phone').in('id', clinicIds) : Promise.resolve({ data: [] as any[] }),
        profIds.length ? admin.from('profiles').select('id, full_name').in('id', profIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const clinicMap = new Map((clinics ?? []).map((c: any) => [c.id, c]));
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));

      const data = (creds ?? []).map((c: any) => {
        const clinic = clinicMap.get(c.clinic_id);
        return {
          professional_id: c.professional_user_id,
          professional_name: profMap.get(c.professional_user_id) ?? null,
          clinic_id: c.clinic_id,
          clinic_name: clinic?.name ?? null,
          clinic_city: clinic?.city ?? null,
          clinic_state: clinic?.state ?? null,
          clinic_phone: clinic?.phone ?? null,
          credentialed_at: c.decided_at ?? c.requested_at,
        };
      });
      return json({ data, meta: { count, limit, offset } });
    }

    if (resource === 'search-network') {
      const { data: memberships, error: memErr } = await admin
        .from('clinic_members')
        .select('clinic_id, user_id, specialty')
        .in('role', ['dentist', 'admin']);
      if (memErr) return json({ error: memErr.message }, 500);

      const clinicIds = [...new Set((memberships ?? []).map((m: any) => m.clinic_id))];
      const userIds = [...new Set((memberships ?? []).map((m: any) => m.user_id))];

      const { limit, offset } = pagination(url);
      const { data: clinicsPage, error: clinicsErr, count } = await admin
        .from('clinics')
        .select('id, name, city, state, cnpj, phone, email, category, address, address_number, neighborhood, zip_code', { count: 'exact' })
        .in('id', clinicIds.length ? clinicIds : ['00000000-0000-0000-0000-000000000000'])
        .order('name')
        .range(offset, offset + limit - 1);
      if (clinicsErr) return json({ error: clinicsErr.message }, 500);

      const [{ data: profiles }, { data: specs }] = await Promise.all([
        userIds.length ? admin.from('profiles').select('id, full_name, phone').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
        userIds.length ? admin.from('professional_specialties').select('user_id, specialty').in('user_id', userIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const specMap = new Map<string, string[]>();
      (specs ?? []).forEach((s: any) => {
        const prev = specMap.get(s.user_id) ?? [];
        if (!prev.includes(s.specialty)) specMap.set(s.user_id, [...prev, s.specialty]);
      });
      const membersByClinic = new Map<string, any[]>();
      (memberships ?? []).forEach((m: any) => {
        const prev = membersByClinic.get(m.clinic_id) ?? [];
        membersByClinic.set(m.clinic_id, [...prev, m]);
      });

      const data = (clinicsPage ?? []).map((clinic: any) => {
        const members = membersByClinic.get(clinic.id) ?? [];
        const professionals = members.map((m: any) => {
          const p = profileMap.get(m.user_id);
          const specialties = specMap.get(m.user_id) ?? (m.specialty ? [m.specialty] : []);
          return {
            professional_id: m.user_id,
            professional_name: p?.full_name ?? null,
            phone: p?.phone ?? null,
            specialties,
          };
        });
        return {
          clinic_id: clinic.id,
          clinic_name: clinic.name,
          category: clinic.category,
          cnpj: clinic.cnpj,
          city: clinic.city,
          state: clinic.state,
          phone: clinic.phone,
          email: clinic.email,
          address: clinic.address,
          address_number: clinic.address_number,
          neighborhood: clinic.neighborhood,
          zip_code: clinic.zip_code,
          specialties: [...new Set(professionals.flatMap((p) => p.specialties).filter(Boolean))],
          professionals,
        };
      });
      return json({ data, meta: { count, limit, offset } });
    }

    return json({ error: 'unknown resource. use one of: ping, network, search-network' }, 400);
  } catch (err) {
    console.error('operator-api error', err);
    return json({ error: (err as Error).message }, 500);
  }
});
