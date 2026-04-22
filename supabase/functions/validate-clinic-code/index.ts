import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limit per IP (10 req/min)
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.reset) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  b.count += 1;
  return b.count > 10;
}

const CODE_REGEX = /^CLIN-[A-Z2-9]{8}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return new Response(JSON.stringify({ valid: false, error: "Muitas tentativas, aguarde 1 minuto." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!CODE_REGEX.test(code)) {
      return new Response(JSON.stringify({ valid: false, error: "Formato inválido. Use CLIN-XXXXXXXX." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: clinic, error } = await admin
      .from("clinics")
      .select("id, name")
      .eq("invite_code", code)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ valid: false, error: "Erro ao validar código." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!clinic) {
      return new Response(JSON.stringify({ valid: false, error: "Código não encontrado. Peça à clínica para gerar um novo." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ valid: true, clinic_name: clinic.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ valid: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});