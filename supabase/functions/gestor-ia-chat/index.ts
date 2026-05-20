import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const gateway = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: {
    "Lovable-API-Key": LOVABLE_API_KEY,
    "X-Lovable-AIG-SDK": "vercel-ai-sdk",
  },
});

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

async function loadClinicContext(admin: ReturnType<typeof createClient>, clinicId: string) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const [clinicQ, membersQ, plansQ, proceduresQ, todayApsQ, weekApsQ, patientsCountQ, finQ] = await Promise.all([
    admin.from("clinics").select("name, address, city, state, phone, email, category").eq("id", clinicId).maybeSingle(),
    admin.from("clinic_members").select("user_id, role, specialty, registration_number").eq("clinic_id", clinicId),
    admin.from("insurance_plans").select("name, type, is_active").eq("clinic_id", clinicId).eq("is_active", true),
    admin.from("procedures" as any).select("name, price").eq("clinic_id", clinicId).limit(50),
    admin.from("appointments").select("status, presence_status, start_time").eq("clinic_id", clinicId).gte("start_time", startToday).lt("start_time", endToday),
    admin.from("appointments").select("start_time, status, dentist_id").eq("clinic_id", clinicId).gte("start_time", startToday).lte("start_time", in7days).neq("status", "cancelled").order("start_time").limit(50),
    admin.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    admin.from("financial_transactions").select("type, amount, status, paid_date").eq("clinic_id", clinicId).gte("due_date", since30),
  ]);

  const clinic = clinicQ.data as any;
  const memberIds = (membersQ.data ?? []).map((m: any) => m.user_id);
  let profilesMap = new Map<string, string>();
  if (memberIds.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", memberIds);
    profilesMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
  }

  const today = todayApsQ.data ?? [];
  const confirmed = today.filter((a: any) => a.status === "confirmed").length;
  const cancelled = today.filter((a: any) => a.status === "cancelled").length;
  const waiting = today.filter((a: any) => a.status === "scheduled").length;

  const fin = finQ.data ?? [];
  const entradas = fin.filter((f: any) => f.type === "income" && f.status === "paid").reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
  const saidas = fin.filter((f: any) => f.type === "expense" && f.status === "paid").reduce((s: number, f: any) => s + Number(f.amount || 0), 0);

  const lines: string[] = [];
  lines.push(`# Clínica`);
  lines.push(`- Nome: ${clinic?.name ?? "—"}`);
  lines.push(`- Endereço: ${[clinic?.address, clinic?.city, clinic?.state].filter(Boolean).join(", ") || "—"}`);
  lines.push(`- Contato: ${clinic?.phone ?? "—"} / ${clinic?.email ?? "—"}`);
  lines.push(`- Categoria: ${clinic?.category ?? "—"}`);

  lines.push(`\n# Convênios aceitos (${plansQ.data?.length ?? 0})`);
  for (const p of plansQ.data ?? []) lines.push(`- ${p.name} (${p.type})`);

  lines.push(`\n# Procedimentos cadastrados (${proceduresQ.data?.length ?? 0})`);
  for (const p of (proceduresQ.data ?? []).slice(0, 30) as any[]) lines.push(`- ${p.name} — ${fmtMoney(Number(p.price))}`);

  lines.push(`\n# Profissionais ativos (${membersQ.data?.length ?? 0})`);
  for (const m of membersQ.data ?? []) {
    lines.push(`- ${profilesMap.get((m as any).user_id) ?? "Sem nome"} — ${(m as any).role}${(m as any).specialty ? " / " + (m as any).specialty : ""}${(m as any).registration_number ? " (reg. " + (m as any).registration_number + ")" : ""}`);
  }

  lines.push(`\n# Agenda de hoje`);
  lines.push(`- Total: ${today.length} | Confirmadas: ${confirmed} | Aguardando: ${waiting} | Canceladas: ${cancelled}`);

  lines.push(`\n# Próximos 7 dias (${weekApsQ.data?.length ?? 0} consultas)`);
  for (const a of (weekApsQ.data ?? []).slice(0, 20) as any[]) {
    const d = new Date(a.start_time);
    lines.push(`- ${d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} — ${a.status}`);
  }

  lines.push(`\n# Pacientes`);
  lines.push(`- Total cadastrados: ${patientsCountQ.count ?? 0}`);

  lines.push(`\n# Financeiro (últimos 30 dias)`);
  lines.push(`- Entradas: ${fmtMoney(entradas)}`);
  lines.push(`- Saídas: ${fmtMoney(saidas)}`);
  lines.push(`- Saldo: ${fmtMoney(entradas - saidas)}`);

  return { clinicName: clinic?.name ?? "sua clínica", contextText: lines.join("\n") };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const messages = body.messages as UIMessage[];
    const threadId = body.threadId as string | undefined;
    const clinicId = body.clinicId as string | undefined;

    if (!threadId || !clinicId) {
      return new Response(JSON.stringify({ error: "threadId e clinicId obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validar thread pertence ao usuário
    const { data: thread } = await admin.from("ia_gestor_threads").select("id, user_id").eq("id", threadId).maybeSingle();
    if (!thread || thread.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Thread inválida" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validar membership na clínica
    const { data: membership } = await admin.from("clinic_members").select("id").eq("clinic_id", clinicId).eq("user_id", user.id).maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Sem acesso a esta clínica" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { clinicName, contextText } = await loadClinicContext(admin, clinicId);

    const system = `Você é o Gestor IA da clínica ${clinicName}. Você tem acesso completo aos dados operacionais abaixo e deve responder como um assistente de gestão clínica especializado. Responda sempre em português, use markdown (negrito, listas, tabelas) quando ajudar. Seja direto e baseie suas respostas nos dados reais fornecidos.\n\n--- DADOS DA CLÍNICA ---\n${contextText}\n--- FIM DOS DADOS ---\n\nQuando o usuário pedir uma imagem (cartaz, logo, ilustração, post, etc.), chame a tool generate_image com um prompt detalhado em inglês.`;

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(50),
      tools: {
        generate_image: tool({
          description: "Gera uma imagem a partir de um prompt. Use quando o usuário pedir cartaz, post, ilustração, logo, foto, etc.",
          inputSchema: z.object({
            prompt: z.string().describe("Prompt detalhado da imagem, em inglês."),
          }),
          execute: async ({ prompt }) => {
            const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Lovable-API-Key": LOVABLE_API_KEY,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: prompt }],
                modalities: ["image", "text"],
              }),
            });
            if (!resp.ok) {
              const t = await resp.text();
              return { error: `Falha ao gerar imagem: ${resp.status} ${t.slice(0, 200)}` };
            }
            const data = await resp.json();
            const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url
              ?? data.choices?.[0]?.message?.images?.[0]?.url;
            if (!imageUrl) return { error: "Imagem não retornada pelo modelo." };
            return { imageUrl, prompt };
          },
        }),
      },
      onError: (err) => {
        console.error("streamText error", err);
      },
    });

    return result.toUIMessageStreamResponse({
      headers: corsHeaders,
      originalMessages: messages,
      onFinish: async ({ messages: finalMessages }) => {
        try {
          const last = finalMessages[finalMessages.length - 1];
          const userMsg = messages[messages.length - 1];
          if (userMsg && userMsg.role === "user") {
            await admin.from("ia_gestor_messages").insert({
              thread_id: threadId,
              role: "user",
              content: (userMsg.parts ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n"),
              parts: userMsg.parts ?? [],
              sdk_message_id: userMsg.id,
            });
          }
          if (last && last.role === "assistant") {
            await admin.from("ia_gestor_messages").insert({
              thread_id: threadId,
              role: "assistant",
              content: (last.parts ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n"),
              parts: last.parts ?? [],
              sdk_message_id: last.id,
            });
          }
          await admin.from("ia_gestor_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
        } catch (e) {
          console.error("Persist error", e);
        }
      },
    });
  } catch (e) {
    console.error("gestor-ia-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});