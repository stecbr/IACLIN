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

    // Profile completeness gate for joining by code.
    // Required: full_name, phone, avatar_url, specialty and registration.
    const [{ data: profile }, { data: existingMember }, { data: personalSpecialty }] = await Promise.all([
      admin
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("clinic_members")
        .select("specialty, registration_number")
        .eq("user_id", user.id)
        .not("registration_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("professional_specialties")
        .select("specialty")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .maybeSingle(),
    ]);

    const resolvedSpecialty = finalSpecialty ?? (existingMember as any)?.specialty ?? (personalSpecialty as any)?.specialty ?? null;
    const resolvedRegistration = finalRegistration ?? (existingMember as any)?.registration_number ?? null;

    const missing: string[] = [];
    if (!(profile as any)?.full_name?.trim?.()) missing.push("nome completo");
    if (!(profile as any)?.phone?.trim?.()) missing.push("telefone");
    if (!(profile as any)?.avatar_url?.trim?.()) missing.push("foto de perfil");
    if (!resolvedSpecialty) missing.push("especialidade");
    if (!resolvedRegistration) missing.push("registro profissional");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Complete seu perfil antes de entrar na clínica. Faltando: ${missing.join(", ")}.`,
          missing_fields: missing,
          code: "PROFILE_INCOMPLETE",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: memErr } = await admin.from("clinic_members").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      role: "dentist",
      specialty: resolvedSpecialty,
      registration_number: resolvedRegistration,
      is_owner: false,
    });
    if (memErr && !memErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: memErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If membership already existed but had no specialty/registration, backfill it.
    if (memErr && memErr.message.includes("duplicate") && (resolvedSpecialty || resolvedRegistration)) {
      const updates: Record<string, string> = {};
      if (resolvedSpecialty) updates.specialty = resolvedSpecialty;
      if (resolvedRegistration) updates.registration_number = resolvedRegistration;
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

    // Sync professional_specialties → clinic_member_specialties
    const { data: memberRow } = await admin
      .from("clinic_members")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberRow) {
      const { data: personalSpecs } = await admin
        .from("professional_specialties")
        .select("specialty")
        .eq("user_id", user.id);

      if (personalSpecs && personalSpecs.length > 0) {
        // Fetch already-existing entries to avoid duplicates
        const { data: existingSpecs } = await admin
          .from("clinic_member_specialties")
          .select("specialty")
          .eq("clinic_member_id", memberRow.id);
        const existingSet = new Set(((existingSpecs ?? []) as unknown as { specialty: string }[]).map((r) => r.specialty));
        const toInsert = (personalSpecs as unknown as { specialty: string }[])
          .filter((s) => !existingSet.has(s.specialty))
          .map((s) => ({ clinic_member_id: memberRow.id, specialty: s.specialty }));
        if (toInsert.length > 0) {
          await admin.from("clinic_member_specialties").insert(toInsert);
        }
      }
    }

    await admin.from("user_roles").insert({ user_id: user.id, role: "dentist" }).select();

    return new Response(JSON.stringify({ success: true, clinic_id: clinic.id, clinic_name: clinic.name }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});