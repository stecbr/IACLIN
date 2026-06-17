import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = caller.id;

    // Parse body
    const body = await req.json();
    const email: string = (body.email ?? '').trim().toLowerCase();
    const full_name: string = (body.full_name ?? '').trim();
    const password: string = body.password ?? '';
    const { role, clinic_id, specialty, registration_number } = body;

    if (!email || !full_name || !password || !role || !clinic_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha precisa ter ao menos 6 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["dentist", "secretary", "auxiliary"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is owner of the clinic
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: ownerCheck } = await adminClient
      .from("clinic_members")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("user_id", callerId)
      .eq("is_owner", true)
      .maybeSingle();

    if (!ownerCheck) {
      return new Response(JSON.stringify({ error: "Only clinic owners can add members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if a user with this email already exists (paginate to avoid missing it on large bases)
    let emailAlreadyExists = false;
    for (let page = 1; page <= 20; page++) {
      const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      const users = list?.users ?? [];
      if (users.some((u: any) => (u.email ?? '').toLowerCase() === email)) {
        emailAlreadyExists = true;
        break;
      }
      if (users.length < 200) break;
    }
    if (emailAlreadyExists) {
      return new Response(JSON.stringify({
        error: "Este e-mail já está cadastrado na plataforma. Use outro e-mail para o funcionário.",
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      const raw = createError.message ?? '';
      const friendly =
        /already been registered|email_exists/i.test(raw)
          ? "Este e-mail já está cadastrado na plataforma. Use outro e-mail para o funcionário."
          : /password.*(at least|short|weak)/i.test(raw)
            ? "A senha precisa ter ao menos 6 caracteres."
            : raw || "Não foi possível criar o usuário.";
      return new Response(JSON.stringify({ error: friendly }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = newUser.user.id;

    // Insert profile, clinic_members, user_roles in parallel
    const [profileRes, memberRes, roleRes] = await Promise.all([
      adminClient.from("profiles").upsert({
        id: newUserId,
        full_name,
      }),
      adminClient.from("clinic_members").insert({
        clinic_id,
        user_id: newUserId,
        role,
        is_owner: false,
        specialty: specialty ?? null,
        registration_number: registration_number ?? null,
      }),
      adminClient.from("user_roles").insert({
        user_id: newUserId,
        role,
      }),
    ]);

    if (profileRes.error || memberRes.error || roleRes.error) {
      const err = profileRes.error?.message || memberRes.error?.message || roleRes.error?.message;
      return new Response(JSON.stringify({ error: `User created but linking failed: ${err}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
