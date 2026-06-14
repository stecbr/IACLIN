import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function normalizeCpf(v: string) { return (v || '').replace(/\D/g, ''); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const full_name = (body.full_name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const cpf = normalizeCpf(body.cpf || '') || null;
    const phone = body.phone || null;
    const clinic_id = body.clinic_id || null;

    if (!full_name || !email) return json({ error: 'missing_fields' }, 400);

    const { data: inv, error } = await admin
      .from('patient_invites')
      .insert({
        requested_by_user_id: user.id,
        clinic_id, full_name, cpf, phone, email,
      })
      .select('id, token')
      .single();
    if (error) throw error;

    // E-mail sending is wired through Lovable transactional infra when available.
    // For now we log the invite link so the platform admin can deliver it manually.
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://iaclin.lovable.app';
    const link = `${siteUrl}/auth?invite=${inv.token}`;
    console.log('[patient-invite] send to', email, 'link:', link);

    return json({ ok: true, invite_id: inv.id, invite_link: link });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}