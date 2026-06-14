import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { request_id, action } = await req.json();
    if (!request_id || !['accept', 'reject'].includes(action)) {
      return json({ error: 'invalid_input' }, 400);
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    const { error } = await supabase
      .from('patient_link_requests')
      .update({ status: newStatus })
      .eq('id', request_id)
      .eq('patient_user_id', user.id)
      .eq('status', 'pending');
    if (error) throw error;

    return json({ ok: true, status: newStatus });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}