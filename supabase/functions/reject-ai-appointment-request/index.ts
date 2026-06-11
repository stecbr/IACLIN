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

// Avisa o paciente no WhatsApp via backend da IA. convId = base64url "clinicId:phone".
const AI_BACKEND_URL = Deno.env.get('AI_BACKEND_URL') ?? 'https://iaclin.stec-apps.com';
async function notifyPatient(clinicId: string, phone: string, text: string) {
  if (!clinicId || !phone || !text) return;
  try {
    const convId = btoa(`${clinicId}:${phone}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await fetch(`${AI_BACKEND_URL}/api/clinics/${clinicId}/conversations/${convId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
      body: JSON.stringify({ text }),
    });
  } catch (_) { /* não bloqueia */ }
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

    const { requestId, reason } = await req.json();
    if (!requestId) return json({ error: 'requestId é obrigatório' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: request } = await admin
      .from('ai_appointment_requests')
      .select('clinic_id, status, patient_phone, patient_name')
      .eq('id', requestId)
      .maybeSingle();
    if (!request) return json({ error: 'Pedido não encontrado' }, 404);
    if (request.status !== 'pending') return json({ error: 'Pedido já foi decidido' }, 400);

    const { data: membership } = await admin
      .from('clinic_members')
      .select('id, role')
      .eq('clinic_id', request.clinic_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!membership || !['admin', 'secretary'].includes(membership.role)) {
      return json({ error: 'Sem permissão' }, 403);
    }

    const { error: updErr } = await admin
      .from('ai_appointment_requests')
      .update({
        status: 'rejected',
        rejection_reason: reason ?? null,
        decided_at: new Date().toISOString(),
        decided_by: userId,
      })
      .eq('id', requestId);
    if (updErr) throw updErr;

    // Avisa o paciente que o horário não pôde ser confirmado e oferece remarcar.
    const nome = (request.patient_name ?? '').split(' ')[0] || '';
    await notifyPatient(
      request.clinic_id,
      request.patient_phone,
      `${nome ? `Olá ${nome}. ` : ''}Infelizmente não conseguimos confirmar o horário solicitado.${reason ? ` Motivo: ${reason}.` : ''} Gostaria de tentar outra data? É só me dizer o dia e horário de sua preferência. 🙏`,
    );

    return json({ success: true });
  } catch (err) {
    console.error('[reject-ai-appointment-request] error', err);
    return json({ error: (err as Error).message }, 500);
  }
});