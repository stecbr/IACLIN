import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_ADMIN_EMAIL = 'iaclin@gmail.com';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // ── Autenticação ──────────────────────────────────────────────
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data: { user }, error: authErr } = await anon.auth.getUser(auth.replace('Bearer ', ''));
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
  if (user.email?.toLowerCase() !== PLATFORM_ADMIN_EMAIL) return json({ error: 'Forbidden' }, 403);

  // ── Cliente com service role (bypassa RLS) ────────────────────
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const type = new URL(req.url).searchParams.get('type') ?? 'stats';

  // ── /stats ────────────────────────────────────────────────────
  if (type === 'stats') {
    const [
      { count: totalClinics },
      { data: memberRows },
      { count: totalPatients },
      { count: activeSubs },
      { count: trialSubs },
      { count: overdueSubs },
    ] = await Promise.all([
      admin.from('clinics').select('*', { count: 'exact', head: true }),
      admin.from('clinic_members').select('user_id').in('role', ['admin', 'dentist']),
      admin.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'patient'),
      admin.from('platform_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').catch(() => ({ count: 0 })),
      admin.from('platform_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'trial').catch(() => ({ count: 0 })),
      admin.from('platform_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'overdue').catch(() => ({ count: 0 })),
    ]);
    const totalDoctors = new Set((memberRows ?? []).map((m: any) => m.user_id)).size;
    return json({
      total_clinics:  totalClinics  ?? 0,
      total_doctors:  totalDoctors,
      total_patients: totalPatients ?? 0,
      active_subs:    activeSubs    ?? 0,
      trial_subs:     trialSubs     ?? 0,
      overdue_subs:   overdueSubs   ?? 0,
    });
  }

  // ── /clinics ──────────────────────────────────────────────────
  if (type === 'clinics') {
    const { data: clinics } = await admin
      .from('clinics')
      .select('id, name, category, city, state, email, phone, created_at')
      .order('created_at', { ascending: false });

    const clinicIds = (clinics ?? []).map((c: any) => c.id);

    // Contagem de membros por clínica
    const { data: members } = await admin
      .from('clinic_members')
      .select('clinic_id')
      .in('clinic_id', clinicIds);

    const countMap: Record<string, number> = {};
    for (const m of members ?? []) {
      countMap[(m as any).clinic_id] = (countMap[(m as any).clinic_id] ?? 0) + 1;
    }

    // Assinaturas (se a tabela já existir)
    let subsMap: Record<string, any> = {};
    try {
      const { data: subs } = await admin
        .from('platform_subscriptions')
        .select('*')
        .eq('entity_type', 'clinic')
        .in('entity_id', clinicIds);
      for (const s of subs ?? []) {
        subsMap[(s as any).entity_id] = s;
      }
    } catch (_) { /* tabela ainda não existe */ }

    const result = (clinics ?? []).map((c: any) => ({
      ...c,
      member_count: countMap[c.id] ?? 0,
      subscription: subsMap[c.id] ?? null,
    }));

    return json(result);
  }

  // ── /doctors ─────────────────────────────────────────────────
  if (type === 'doctors') {
    const { data: members } = await admin
      .from('clinic_members')
      .select('user_id, clinic_id, role, specialty, registration_number, is_owner, created_at')
      .in('role', ['admin', 'dentist'])
      .order('created_at', { ascending: false });

    const userIds   = [...new Set((members ?? []).map((m: any) => m.user_id))];
    const clinicIds = [...new Set((members ?? []).map((m: any) => m.clinic_id).filter(Boolean))];

    const [{ data: profiles }, { data: clinicsData }] = await Promise.all([
      admin.from('profiles').select('id, full_name').in('id', userIds),
      admin.from('clinics').select('id, name').in('id', clinicIds),
    ]);

    const profMap: Record<string, string | null> = {};
    for (const p of profiles ?? []) profMap[(p as any).id] = (p as any).full_name;

    const clinicNameMap: Record<string, string> = {};
    for (const c of clinicsData ?? []) clinicNameMap[(c as any).id] = (c as any).name;

    // Assinaturas por médico
    let subsMap: Record<string, any> = {};
    try {
      const { data: subs } = await admin
        .from('platform_subscriptions')
        .select('*')
        .eq('entity_type', 'doctor')
        .in('entity_id', userIds);
      for (const s of subs ?? []) {
        subsMap[(s as any).entity_id] = s;
      }
    } catch (_) { /* tabela ainda não existe */ }

    const result = (members ?? []).map((m: any) => ({
      user_id:      m.user_id,
      full_name:    profMap[m.user_id] ?? null,
      specialty:    m.specialty ?? null,
      registration: m.registration_number ?? null,
      role:         m.role,
      is_owner:     m.is_owner,
      clinic_id:    m.clinic_id ?? null,
      clinic_name:  m.clinic_id ? (clinicNameMap[m.clinic_id] ?? null) : null,
      created_at:   m.created_at,
      subscription: subsMap[m.user_id] ?? null,
    }));

    return json(result);
  }

  return json({ error: 'Unknown type' }, 400);
});
