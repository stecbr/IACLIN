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

    if (resource === 'beneficiaries') {
      const { limit, offset } = pagination(url);
      const { data, error, count } = await admin
        .from('operator_beneficiaries')
        .select('id, full_name, cpf, card_number, plan_name, plan_type, status, enrolled_at, next_due_date', { count: 'exact' })
        .eq('operator_id', operatorId)
        .order('full_name')
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);
      return json({ data, meta: { count, limit, offset } });
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

    if (resource === 'price-table') {
      const today = new Date().toISOString().slice(0, 10);
      const { data: tables } = await admin
        .from('operator_price_tables')
        .select('id, name, valid_from, valid_until')
        .eq('operator_id', operatorId)
        .lte('valid_from', today)
        .order('valid_from', { ascending: false });
      const activeTable = (tables ?? []).find((t: any) => !t.valid_until || t.valid_until >= today) ?? (tables ?? [])[0];
      if (!activeTable) return json({ data: [], meta: { count: 0, limit: 0, offset: 0, table: null } });

      const { limit, offset } = pagination(url);
      const { data, error, count } = await admin
        .from('operator_price_items')
        .select('procedure_name, tuss_code, category, charge_type, value_brl', { count: 'exact' })
        .eq('table_id', activeTable.id)
        .order('sort_order')
        .range(offset, offset + limit - 1);
      if (error) return json({ error: error.message }, 500);
      return json({ data, meta: { count, limit, offset, table: { id: activeTable.id, name: activeTable.name } } });
    }

    return json({ error: 'unknown resource. use one of: ping, beneficiaries, network, price-table' }, 400);
  } catch (err) {
    console.error('operator-api error', err);
    return json({ error: (err as Error).message }, 500);
  }
});
