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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { clinicId } = await req.json();
    if (!clinicId) {
      return json({ error: 'clinicId é obrigatório' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // 1. Busca agendamentos pendentes no backend da IA
    const listRes = await fetch(
      `${AI_BACKEND_URL}/api/clinics/${clinicId}/appointments?source=ai&sync_status=pending`,
      { headers: aiHeaders },
    );
    if (!listRes.ok) {
      return json({ error: `Backend IA respondeu ${listRes.status}` }, 502);
    }
    const listBody = await listRes.json();
    const pending = Array.isArray(listBody?.data) ? listBody.data : [];

    let created = 0;
    const errors: string[] = [];

    for (const apt of pending) {
      const startTime = apt.scheduled_at ?? apt.start_time ?? apt.scheduledAt;
      if (!startTime) { errors.push(`apt ${apt.id}: sem data`); continue; }

      // Evita duplicar: se já existe um request com esse external_ref, pula
      const { data: existing } = await admin
        .from('ai_appointment_requests')
        .select('id')
        .eq('external_ref', apt.id)
        .maybeSingle();
      if (existing) {
        // já sincronizado antes — apenas confirma de volta e segue
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
      // 3. Confirma no backend da IA que sincronizou (para não retornar de novo)
      await confirmSync(clinicId, apt.id);
    }

    return json({ ok: true, synced: created, total: pending.length, errors });
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
