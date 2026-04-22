import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: invite, error: invErr } = await admin
      .from("clinic_invites")
      .select("id, clinic_id, email, full_name, specialty, registration_number, role, status, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: "Convite inválido" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (invite.status !== "pending") {
      return new Response(JSON.stringify({ error: "Convite já utilizado ou revogado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Convite expirado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert membership (idempotent via UNIQUE)
    const { error: memErr } = await admin
      .from("clinic_members")
      .insert({
        clinic_id: invite.clinic_id,
        user_id: user.id,
        role: invite.role,
        specialty: invite.specialty,
        registration_number: invite.registration_number,
        is_owner: false,
      });
    if (memErr && !memErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure dentist role
    await admin.from("user_roles").insert({ user_id: user.id, role: invite.role }).select();

    // Mark invite accepted
    await admin.from("clinic_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);

    return new Response(JSON.stringify({ success: true, clinic_id: invite.clinic_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});