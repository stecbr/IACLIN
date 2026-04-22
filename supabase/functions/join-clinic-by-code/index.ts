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

    const { code, specialty, registration_number } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Código inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const normalized = code.trim().toUpperCase();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: clinic } = await admin
      .from("clinics")
      .select("id, name")
      .eq("invite_code", normalized)
      .maybeSingle();
    if (!clinic) {
      return new Response(JSON.stringify({ error: "Código de clínica não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: memErr } = await admin.from("clinic_members").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      role: "dentist",
      specialty: specialty?.trim() || null,
      registration_number: registration_number?.trim() || null,
      is_owner: false,
    });
    if (memErr && !memErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("user_roles").insert({ user_id: user.id, role: "dentist" }).select();

    return new Response(JSON.stringify({ success: true, clinic_id: clinic.id, clinic_name: clinic.name }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});