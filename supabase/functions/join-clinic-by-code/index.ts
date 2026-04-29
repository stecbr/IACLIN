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

    // Fallback: pull specialty / registration from the user's signup metadata
    // (auth.users.raw_user_meta_data) when the client doesn't pass them.
    let metaSpecialty: string | null = null;
    let metaRegistration: string | null = null;
    try {
      const { data: full } = await admin.auth.admin.getUserById(user.id);
      const md = (full?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const s = typeof md.specialty === "string" ? md.specialty.trim() : "";
      const r = typeof md.registration_number === "string" ? md.registration_number.trim() : "";
      metaSpecialty = s || null;
      metaRegistration = r || null;
    } catch (_) {
      // ignore — fallback simply stays null
    }

    const finalSpecialty =
      (typeof specialty === "string" && specialty.trim()) ? specialty.trim() : metaSpecialty;
    const finalRegistration =
      (typeof registration_number === "string" && registration_number.trim())
        ? registration_number.trim()
        : metaRegistration;

    const { error: memErr } = await admin.from("clinic_members").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      role: "dentist",
      specialty: finalSpecialty,
      registration_number: finalRegistration,
      is_owner: false,
    });
    if (memErr && !memErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If membership already existed but had no specialty/registration, backfill it.
    if (memErr && memErr.message.includes("duplicate") && (finalSpecialty || finalRegistration)) {
      const updates: Record<string, string> = {};
      if (finalSpecialty) updates.specialty = finalSpecialty;
      if (finalRegistration) updates.registration_number = finalRegistration;
      // Only fill in nulls, don't overwrite existing values.
      const { data: existing } = await admin
        .from("clinic_members")
        .select("specialty, registration_number")
        .eq("clinic_id", clinic.id)
        .eq("user_id", user.id)
        .maybeSingle();
      const patch: Record<string, string> = {};
      if (existing && !existing.specialty && updates.specialty) patch.specialty = updates.specialty;
      if (existing && !existing.registration_number && updates.registration_number) {
        patch.registration_number = updates.registration_number;
      }
      if (Object.keys(patch).length > 0) {
        await admin
          .from("clinic_members")
          .update(patch)
          .eq("clinic_id", clinic.id)
          .eq("user_id", user.id);
      }
    }

    await admin.from("user_roles").insert({ user_id: user.id, role: "dentist" }).select();

    return new Response(JSON.stringify({ success: true, clinic_id: clinic.id, clinic_name: clinic.name }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});