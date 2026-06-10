// Edge function: sincroniza agendamentos criados pela IA Secretária (WhatsApp)
// do backend da IA para a tabela ai_appointment_requests no Supabase.
//
// Fluxo:
//   1. Lê GET /api/clinics/:clinicId/appointments?source=ai&sync_status=pending
//   2. Para cada pedido, insere em ai_appointment_requests (status=pending)
//   3. Confirma POST /api/clinics/:clinicId/appointments/:id/sync-confirm
//
// Pode ser chamada manualmente (botão "Sincronizar") ou por cron (pg_cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// URL do backend da IA (AWS EC2). Configurar em Secrets como AI_BACKEND_URL.
const AI_BACKEND_URL = Deno.env.get('AI_BACKEND_URL') ?? 'https://iaclin.stec-apps.com';

const aiHeaders = { 'bypass-tunnel-reminder': 'true', 'Content-Type': 'application/json' };

// Sincroniza os pedidos pendentes de UMA clínica. Retorna contagem.
async function syncOneClinic(admin: any, clinicId: string) {
  const listRes = await fetch(
    `${AI_BACKEND_URL}/api/clinics/${clinicId}/appointments?source=ai&sync_status=pending`,
    { headers: aiHeaders },
  );
  if (!listRes.ok) {
    return { clinicId, synced: 0, total: 0, errors: [`Backend IA respondeu ${listRes.status}`] };
  }
  const listBody = await listRes.json();
  const pending = Array.isArray(listBody?.data) ? listBody.data : [];

  let created = 0;
  const errors: string[] = [];

  for (const apt of pending) {
    const startTime = apt.scheduled_at ?? apt.start_time ?? apt.scheduledAt;
    if (!startTime) { errors.push(`apt ${apt.id}: sem data`); continue; }

    const { data: existing } = await admin
      .from('ai_appointment_requests')
      .select('id')
      .eq('external_ref', apt.id)
      .maybeSingle();
    if (existing) {
      await confirmSync(clinicId, apt.id);
      continue;
    }

    const { error } = await admin.from('ai_appointment_requests').insert({
      clinic_id: clinicId,
      patient_name: apt.patient_name ?? null,
      patient_phone: apt.patient_phone ?? null,
      patient_id: apt.patient_provisional ? null : (apt.patient_id ?? null),
      requested_at: new Date(startTime).toISOString(),
      notes: apt.notes ?? null,
      status: 'pending',
      source: 'ai_whatsapp',
      external_ref: apt.id,
    });

    if (error) { errors.push(`apt ${apt.id}: ${error.message}`); continue; }

    created++;
    await confirmSync(clinicId, apt.id);
  }

  return { clinicId, synced: created, total: pending.length, errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // body pode vir vazio (chamada do cron) — nesse caso sincroniza TODAS as clínicas.
    const body = await req.json().catch(() => ({}));
    const clinicId = body?.clinicId ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Caso 1: clínica específica (botão "Sincronizar agora" no painel).
    if (clinicId) {
      const res = await syncOneClinic(admin, clinicId);
      return json({ ok: true, ...res });
    }

    // Caso 2: sem clinicId (cron) → todas as clínicas com a Secretária IA ativa.
    const { data: configs } = await admin
      .from('ai_secretary_config')
      .select('clinic_id')
      .eq('enabled', true)
      .not('clinic_id', 'is', null);
    const clinicIds = [...new Set((configs ?? []).map((c: any) => c.clinic_id))];

    const results = [];
    let totalSynced = 0;
    for (const cid of clinicIds) {
      const res = await syncOneClinic(admin, cid as string);
      totalSynced += res.synced;
      if (res.synced > 0 || res.errors.length > 0) results.push(res);
    }
    return json({ ok: true, clinics: clinicIds.length, totalSynced, results });
  } catch (e) {
    console.error('sync-ai-appointments error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function confirmSync(clinicId: string, aptId: string) {
  try {
    await fetch(
      `${AI_BACKEND_URL}/api/clinics/${clinicId}/appointments/${aptId}/sync-confirm`,
      { method: 'POST', headers: aiHeaders },
    );
  } catch (_) { /* não bloqueia o fluxo */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
