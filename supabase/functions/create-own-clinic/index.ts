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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: {
      name?: string;
      category?: string;
      specialty?: string;
      registration_number?: string;
      legal_name?: string;
      trade_name?: string;
      cnpj?: string;
      phone?: string;
      responsible_name?: string;
      category_label?: string | null;
      address?: string;
      address_number?: string;
      address_complement?: string | null;
      neighborhood?: string | null;
      city?: string;
      state?: string;
      zip_code?: string;
      entity_type?: 'fisica' | 'juridica';
      cpf?: string | null;
      rg?: string | null;
      birth_date?: string | null;
      inss_pis?: string | null;
      state_registration?: string | null;
      municipal_registration?: string | null;
      cnes?: string | null;
      specialty_certificate?: string | null;
      bank_name?: string | null;
      bank_agency?: string | null;
      bank_account?: string | null;
      bank_account_type?: string | null;
      bank_holder_document?: string | null;
      email?: string | null;
    } = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // If the user already owns a clinic, just return it (idempotent).
    const { data: existing } = await admin
      .from("clinics")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ clinic_id: existing.id, name: existing.name, already_existed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull metadata from auth.users to derive defaults.
    let fullName: string | null = null;
    let metaSpecialty: string | null = null;
    let metaRegistration: string | null = null;
    let metaCategory: string | null = null;
    try {
      const { data: full } = await admin.auth.admin.getUserById(user.id);
      const md = (full?.user?.user_metadata ?? {}) as Record<string, unknown>;
      fullName = typeof md.full_name === "string" ? md.full_name : null;
      metaSpecialty = typeof md.specialty === "string" ? md.specialty : null;
      metaRegistration = typeof md.registration_number === "string" ? md.registration_number : null;
      metaCategory = typeof md.clinic_category === "string" ? md.clinic_category : null;
    } catch (_) {
      // ignore
    }

    const validCategories = ["odonto", "medico", "estetica", "veterinario", "outro"];
    const requestedCategory = body.category ?? metaCategory ?? "outro";
    const category = validCategories.includes(requestedCategory) ? requestedCategory : "outro";

    const baseName = (body.trade_name ?? body.name ?? fullName ?? user.email ?? "Meu consultório").trim();
    const specialtyForName = body.specialty ?? metaSpecialty;
    let clinicName: string;
    if (body.trade_name) {
      // explicit clinic registration: use the trade name as-is
      clinicName = baseName;
    } else {
      const root = baseName.toLowerCase().startsWith("dr")
        ? `Consultório ${baseName}`
        : `Consultório de ${baseName}`;
      clinicName = specialtyForName ? `${root} — ${specialtyForName}` : root;
    }

    const { data: created, error: createErr } = await admin
      .from("clinics")
      .insert({
        name: clinicName,
        legal_name: body.legal_name ?? null,
        responsible_name: body.responsible_name ?? null,
        cnpj: body.cnpj ?? null,
        phone: body.phone ?? null,
        owner_id: user.id,
        category,
        email: user.email,
        category_label: body.category_label ?? null,
        address: body.address ?? null,
        address_number: body.address_number ?? null,
        address_complement: body.address_complement ?? null,
        neighborhood: body.neighborhood ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        zip_code: body.zip_code ?? null,
        entity_type: body.entity_type ?? (body.cpf && !body.cnpj ? 'fisica' : body.cnpj ? 'juridica' : 'fisica'),
        cpf: body.cpf ?? null,
        rg: body.rg ?? null,
        birth_date: body.birth_date ?? null,
        inss_pis: body.inss_pis ?? null,
        state_registration: body.state_registration ?? null,
        municipal_registration: body.municipal_registration ?? null,
        cnes: body.cnes ?? null,
        specialty_certificate: body.specialty_certificate ?? null,
        bank_name: body.bank_name ?? null,
        bank_agency: body.bank_agency ?? null,
        bank_account: body.bank_account ?? null,
        bank_account_type: body.bank_account_type ?? null,
        bank_holder_document: body.bank_holder_document ?? null,
      })
      .select("id, name")
      .single();
    if (createErr || !created) {
      return new Response(
        JSON.stringify({ error: createErr?.message ?? "Falha ao criar consultório" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure admin role
    await admin.from("user_roles").insert({ user_id: user.id, role: "admin" }).select();

    // Update specialty/registration on the auto-linked clinic_members row, if applicable.
    const finalSpecialty = body.specialty ?? metaSpecialty;
    const finalRegistration = body.registration_number ?? metaRegistration;
    if (finalSpecialty || finalRegistration) {
      await admin
        .from("clinic_members")
        .update({
          specialty: finalSpecialty ?? undefined,
          registration_number: finalRegistration ?? undefined,
        })
        .eq("clinic_id", created.id)
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ clinic_id: created.id, name: created.name, already_existed: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});