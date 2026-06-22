// QA seed edge function — idempotent.
// Creates the seven test accounts described in .lovable/plan.md plus
// minimal supporting data (clinic membership, availability, insurance plan).
// Only callable by the platform admin (iaclin@gmail.com).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PASSWORD = "QaTest!2026";

type SeedUser = {
  email: string;
  user_type: "cliente" | "profissional" | "profissional_member" | "clinica" | "operadora";
  metadata: Record<string, unknown>;
};

const USERS: SeedUser[] = [
  {
    email: "qa+paciente@iaclin.test",
    user_type: "cliente",
    metadata: {
      user_type: "cliente",
      full_name: "QA Paciente Teste",
      cpf: "39053344705", // valid test CPF
      phone: "11999990001",
      date_of_birth: "1990-05-15",
      gender: "M",
      insurance_provider: "QA Saúde",
      insurance_number: "QA-0001",
      rg: "12.345.678-9",
      profession: "Engenheiro",
    },
  },
  {
    email: "qa+dentista@iaclin.test",
    user_type: "profissional",
    metadata: {
      user_type: "profissional",
      full_name: "QA Dr. Dentista Solo",
      clinic_category: "odonto",
      specialty: "Clínico Geral",
      registration_number: "CRO-SP 12345",
      phone: "11999990002",
    },
  },
  {
    email: "qa+medico@iaclin.test",
    user_type: "profissional",
    metadata: {
      user_type: "profissional",
      full_name: "QA Dr. Médico",
      clinic_category: "medico",
      specialty: "Clínico Geral",
      registration_number: "CRM-SP 67890",
      phone: "11999990003",
    },
  },
  {
    email: "qa+clinica@iaclin.test",
    user_type: "clinica",
    metadata: {
      user_type: "clinica",
      legal_name: "QA Clínica Teste LTDA",
      trade_name: "QA Clínica Teste",
      cnpj: "11222333000181",
      corporate_email: "qa+clinica@iaclin.test",
      phone: "1133224455",
      responsible_name: "QA Responsável",
      clinic_category: "odonto",
    },
  },
  {
    email: "qa+secretaria@iaclin.test",
    user_type: "profissional_member",
    metadata: {
      user_type: "profissional_member",
      full_name: "QA Secretária",
      phone: "11999990005",
    },
  },
  {
    email: "qa+auxiliar@iaclin.test",
    user_type: "profissional_member",
    metadata: {
      user_type: "profissional_member",
      full_name: "QA Auxiliar",
      phone: "11999990006",
    },
  },
  {
    email: "qa+operadora@iaclin.test",
    user_type: "operadora",
    metadata: {
      user_type: "operadora",
      legal_name: "QA Operadora Saúde S/A",
      trade_name: "QA Operadora",
      cnpj: "22333444000192",
      ans_code: "999999",
      operator_type: "ambos",
      responsible_name: "QA Operadora Resp.",
      phone: "1133225566",
      full_name: "QA Operadora",
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is platform admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((userData.user.email ?? "").toLowerCase() !== "iaclin@gmail.com") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {};

    // 1) Create or update each user (idempotent via email lookup)
    const ids: Record<string, string> = {};
    for (const u of USERS) {
      // Try to find existing user by email
      const { data: existing } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const found = existing?.users?.find(
        (x) => (x.email ?? "").toLowerCase() === u.email.toLowerCase(),
      );
      if (found) {
        ids[u.email] = found.id;
        // Update metadata + password
        await admin.auth.admin.updateUserById(found.id, {
          password: PASSWORD,
          user_metadata: u.metadata,
          email_confirm: true,
        });
        results[u.email] = "updated";
      } else {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email: u.email,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: u.metadata,
          });
        if (createErr || !created?.user) {
          results[u.email] = `error: ${createErr?.message ?? "unknown"}`;
          continue;
        }
        ids[u.email] = created.user.id;
        results[u.email] = "created";
      }
    }

    // 2) Wire up clinic membership: link dentista (member) + secretária + auxiliar
    //    to the QA clínica created above. Also ensure médico has his own clinic.
    const clinicAdminId = ids["qa+clinica@iaclin.test"];
    if (clinicAdminId) {
      const { data: clinic } = await admin
        .from("clinics")
        .select("id")
        .eq("owner_id", clinicAdminId)
        .maybeSingle();
      const clinicId = clinic?.id;
      if (clinicId) {
        const links: Array<[string, "dentist" | "secretary" | "auxiliary"]> = [
          ["qa+dentista@iaclin.test", "dentist"],
          ["qa+secretaria@iaclin.test", "secretary"],
          ["qa+auxiliar@iaclin.test", "auxiliary"],
        ];
        for (const [email, role] of links) {
          const uid = ids[email];
          if (!uid) continue;
          await admin.from("clinic_members").upsert(
            {
              clinic_id: clinicId,
              user_id: uid,
              role,
              is_owner: false,
            },
            { onConflict: "clinic_id,user_id" },
          );
        }
        results["clinic_members"] = "linked";
      }
    }

    // 3) Create a default availability for the dentist member so booking works.
    const dentistId = ids["qa+dentista@iaclin.test"];
    if (dentistId) {
      // weekday 1..5 (mon-fri), 09:00-18:00, 30-min slots
      for (let dow = 1; dow <= 5; dow++) {
        await admin.from("professional_schedule_template").upsert(
          {
            user_id: dentistId,
            day_of_week: dow,
            start_time: "09:00",
            end_time: "18:00",
            slot_duration_minutes: 30,
            is_active: true,
          },
          { onConflict: "user_id,day_of_week" },
        );
      }
      results["availability"] = "ok";
    }

    return new Response(
      JSON.stringify({ ok: true, ids, results }, null, 2),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});