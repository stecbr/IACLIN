import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateToken(len = 40) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { clinic_id, email, full_name, specialty, registration_number } = body ?? {};
    if (!clinic_id || !email || !full_name) {
      return new Response(JSON.stringify({ error: "clinic_id, email and full_name are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller is owner OR admin+member of the clinic
    const { data: membership } = await admin
      .from("clinic_members")
      .select("is_owner")
      .eq("clinic_id", clinic_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this clinic" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!membership.is_owner) {
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Only owner or admin can invite" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const token = generateToken(40);
    const { data: invite, error: insertErr } = await admin
      .from("clinic_invites")
      .insert({
        clinic_id,
        email: String(email).trim().toLowerCase(),
        full_name: String(full_name).trim(),
        specialty: specialty?.trim() || null,
        registration_number: registration_number?.trim() || null,
        role: "dentist",
        token,
        invited_by: user.id,
        status: "pending",
      })
      .select("id, token, expires_at")
      .single();
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build invite link (frontend route)
    const origin = req.headers.get("origin") ?? "";
    const inviteUrl = `${origin}/auth?invite=${token}`;

    return new Response(
      JSON.stringify({ success: true, invite_id: invite.id, invite_url: inviteUrl, expires_at: invite.expires_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});