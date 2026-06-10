// Edge Function: max-noshow
// Detecta no-show e marca as consultas automaticamente.
//
// Regra (escopo MAX/Yuri): consultas cujo horário passou há mais de 30 min,
// que ainda estão em 'scheduled'/'confirmed' e cujo paciente NÃO chegou
// (presence_status = 'not_arrived'), são marcadas como status = 'no_show'.
//
// Não toca em consultas já 'completed', 'cancelled' ou que o paciente chegou
// ('arrived'/'in_service'/'finished').
//
// Disparo: pg_cron a cada 30 min (ver SQL ao final do arquivo, em comentário).
// Pode também ser chamada manualmente (POST sem body) para testes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Tolerância após o horário antes de considerar no-show (30 min).
const GRACE_MINUTES = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000).toISOString();

    // Busca candidatas a no-show: horário já passou da tolerância, ainda
    // 'scheduled'/'confirmed', e o paciente não chegou.
    const { data: candidates, error: selErr } = await admin
      .from('appointments')
      .select('id, clinic_id, patient_id, start_time, status, presence_status')
      .lt('start_time', cutoff)
      .in('status', ['scheduled', 'confirmed'])
      .eq('presence_status', 'not_arrived');

    if (selErr) {
      console.error('max-noshow select error', selErr);
      return json({ error: selErr.message }, 500);
    }

    const ids = (candidates ?? []).map((a) => a.id);
    if (ids.length === 0) {
      return json({ ok: true, marked: 0, message: 'Nenhum no-show a marcar' });
    }

    const { error: updErr } = await admin
      .from('appointments')
      .update({ status: 'no_show' })
      .in('id', ids);

    if (updErr) {
      console.error('max-noshow update error', updErr);
      return json({ error: updErr.message }, 500);
    }

    // Sinaliza os gestores da clínica: cria 1 notificação por admin/secretary
    // de cada clínica afetada. (notifications.user_id é obrigatório, por isso
    // resolvemos os membros via clinic_members.) Não bloqueia se falhar.
    try {
      const clinicIds = [...new Set((candidates ?? []).map((a) => a.clinic_id).filter(Boolean))];
      if (clinicIds.length > 0) {
        const { data: members } = await admin
          .from('clinic_members')
          .select('clinic_id, user_id, role')
          .in('clinic_id', clinicIds)
          .in('role', ['admin', 'secretary']);

        const byClinic: Record<string, number> = {};
        for (const a of candidates ?? []) {
          if (a.clinic_id) byClinic[a.clinic_id] = (byClinic[a.clinic_id] ?? 0) + 1;
        }

        const notes = (members ?? []).map((m) => ({
          clinic_id: m.clinic_id,
          user_id: m.user_id,
          type: 'no_show',
          title: 'Paciente(s) não compareceu(ram)',
          message: `${byClinic[m.clinic_id] ?? 0} consulta(s) marcada(s) como falta automaticamente.`,
          reference_type: 'appointment',
          read: false,
        }));
        if (notes.length > 0) {
          await admin.from('notifications').insert(notes);
        }
      }
    } catch (notifErr) {
      // Não bloqueia o no-show se a notificação falhar.
      console.warn('max-noshow notification skip', notifErr);
    }

    console.log(`max-noshow: ${ids.length} consultas marcadas como no_show`);
    return json({ ok: true, marked: ids.length, ids });
  } catch (e) {
    console.error('max-noshow fatal', e);
    return json({ error: (e as Error).message }, 500);
  }
});

/*
─────────────────────────────────────────────────────────────────────────────
 AGENDAMENTO (rodar UMA vez no SQL Editor do Supabase, após deploy da função):

 -- Habilita extensões (se ainda não estiverem):
 create extension if not exists pg_cron;
 create extension if not exists pg_net;

 -- Agenda a cada 30 min. Troque <PROJECT_REF> e <SERVICE_ROLE_KEY>.
 select cron.schedule(
   'max-noshow-every-30min',
   '*/30 * * * *',
   $$
   select net.http_post(
     url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/max-noshow',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
     ),
     body    := '{}'::jsonb
   );
   $$
 );

 -- Para remover depois, se precisar:
 -- select cron.unschedule('max-noshow-every-30min');
─────────────────────────────────────────────────────────────────────────────
*/
