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
  const since60 = new Date(now.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  // Janela para análise de no-show / produção: últimos 30 dias de consultas
  const apptSince30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  // Inativos: sem consulta há mais de 180 dias
  const inactiveCutoff = new Date(now.getTime() - 180 * 86400000).toISOString();
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [clinicQ, membersQ, plansQ, proceduresQ, todayApsQ, weekApsQ, patientsCountQ, finQ,
         finPrevQ, recentApsQ, inactiveQ, birthdaysQ, pendingReqQ, templatesQ, availOverridesQ,
         blockedQ, busyApsQ] = await Promise.all([
    admin.from("clinics").select("name, address, city, state, phone, email, category").eq("id", clinicId).maybeSingle(),
    admin.from("clinic_members").select("user_id, role, specialty, registration_number").eq("clinic_id", clinicId),
    admin.from("insurance_plans").select("name, type, is_active").eq("clinic_id", clinicId).eq("is_active", true),
    admin.from("procedures" as any).select("name, price").eq("clinic_id", clinicId).limit(50),
    admin.from("appointments").select("status, presence_status, start_time").eq("clinic_id", clinicId).gte("start_time", startToday).lt("start_time", endToday),
    admin.from("appointments").select("start_time, status, dentist_id").eq("clinic_id", clinicId).gte("start_time", startToday).lte("start_time", in7days).neq("status", "cancelled").order("start_time").limit(50),
    admin.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    admin.from("financial_transactions").select("type, amount, status, paid_date").eq("clinic_id", clinicId).gte("due_date", since30),
    // Faturamento do mês anterior (30-60 dias atrás) para comparativo
    admin.from("financial_transactions").select("type, amount, status").eq("clinic_id", clinicId).gte("due_date", since60).lt("due_date", since30),
    // Consultas dos últimos 30 dias para taxa de no-show e procedimentos mais feitos
    admin.from("appointments").select("status, presence_status, procedures(name)").eq("clinic_id", clinicId).gte("start_time", apptSince30).lt("start_time", startToday),
    // Pacientes com consulta nos últimos 180 dias (para calcular inativos = total - ativos)
    admin.from("appointments").select("patient_id").eq("clinic_id", clinicId).gte("start_time", inactiveCutoff).not("patient_id", "is", null),
    // Aniversariantes do dia
    admin.from("patients").select("full_name, date_of_birth").eq("clinic_id", clinicId).not("date_of_birth", "is", null).limit(500),
    // Pedidos de consulta pendentes (aguardando aprovação)
    admin.from("appointment_requests").select("start_time, end_time, dentist_id, specialty, patient_account_snapshot, created_at").eq("clinic_id", clinicId).eq("status", "pending").order("start_time").limit(30),
    // Templates de horário por profissional (clínica + sem clínica vinculada)
    admin.from("professional_schedule_template").select("user_id, clinic_id, weekday, is_active, start_time, end_time, breaks").or(`clinic_id.eq.${clinicId},clinic_id.is.null`),
    // Sobrescrições de disponibilidade (próximos 7 dias)
    admin.from("professional_availability").select("user_id, work_date, start_time, end_time, breaks").eq("clinic_id", clinicId).gte("work_date", startToday.slice(0,10)).lte("work_date", in7days.slice(0,10)),
    // Datas bloqueadas
    admin.from("professional_blocked_dates").select("user_id, blocked_date").or(`clinic_id.eq.${clinicId},clinic_id.is.null`).gte("blocked_date", startToday.slice(0,10)).lte("blocked_date", in7days.slice(0,10)),
    // Consultas ocupando horários nos próximos 7 dias
    admin.from("appointments").select("dentist_id, start_time, end_time").eq("clinic_id", clinicId).gte("start_time", startToday).lte("start_time", in7days).neq("status", "cancelled"),
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
  const aReceber = fin.filter((f: any) => f.type === "income" && f.status === "pending").reduce((s: number, f: any) => s + Number(f.amount || 0), 0);

  // Comparativo com mês anterior
  const finPrev = finPrevQ.data ?? [];
  const entradasPrev = finPrev.filter((f: any) => f.type === "income" && f.status === "paid").reduce((s: number, f: any) => s + Number(f.amount || 0), 0);
  const varReceita = entradasPrev > 0 ? ((entradas - entradasPrev) / entradasPrev) * 100 : null;

  // Taxa de no-show e procedimentos mais feitos (últimos 30d)
  const recentAps = recentApsQ.data ?? [];
  const totalRecent = recentAps.length;
  const noShows = recentAps.filter((a: any) => a.presence_status === "no_show" || a.status === "no_show").length;
  const noShowRate = totalRecent > 0 ? (noShows / totalRecent) * 100 : 0;
  const procCount = new Map<string, number>();
  for (const a of recentAps as any[]) {
    const name = a.procedures?.name;
    if (name) procCount.set(name, (procCount.get(name) ?? 0) + 1);
  }
  const topProcs = [...procCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Aniversariantes de hoje
  const birthdays = (birthdaysQ.data ?? []).filter((p: any) => {
    if (!p.date_of_birth) return false;
    return String(p.date_of_birth).slice(5, 10) === todayMMDD;
  });

  // Inativos = total de pacientes − pacientes com consulta nos últimos 180d
  const activePatientIds = new Set((inactiveQ.data ?? []).map((a: any) => a.patient_id).filter(Boolean));
  const totalPatients = patientsCountQ.count ?? 0;
  const inactiveCount = Math.max(0, totalPatients - activePatientIds.size);

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

  // ===== Pedidos de consulta pendentes =====
  const pendingReqs = (pendingReqQ.data ?? []) as any[];
  lines.push(`\n# Pedidos de consulta pendentes (${pendingReqs.length})`);
  if (pendingReqs.length === 0) {
    lines.push(`- Nenhum pedido aguardando aprovação no momento.`);
  } else {
    for (const r of pendingReqs.slice(0, 15)) {
      const d = new Date(r.start_time);
      const pName = r.patient_account_snapshot?.full_name ?? "paciente";
      const docName = profilesMap.get(r.dentist_id) ?? "—";
      const spec = r.specialty ? ` / ${r.specialty}` : "";
      lines.push(`- ${d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} — ${pName} com ${docName}${spec}`);
    }
    if (pendingReqs.length > 15) lines.push(`- (+ ${pendingReqs.length - 15} pedidos)`);
  }

  // ===== Horários disponíveis (próximos 7 dias) =====
  const SLOT_MIN = 30;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const fromMin = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const subtractBusy = (intervals: Array<[number, number]>, busy: Array<[number, number]>) => {
    let result = intervals.slice();
    for (const [bs, be] of busy) {
      const next: Array<[number, number]> = [];
      for (const [s, e] of result) {
        if (be <= s || bs >= e) { next.push([s, e]); continue; }
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
      result = next;
    }
    return result;
  };

  const templates = (templatesQ.data ?? []) as any[];
  const overrides = (availOverridesQ.data ?? []) as any[];
  const blocked = new Set(
    ((blockedQ.data ?? []) as any[]).map((b) => `${b.user_id}|${b.blocked_date}`),
  );
  const busyByDoc: Record<string, Array<{ date: string; start: number; end: number }>> = {};
  for (const a of (busyApsQ.data ?? []) as any[]) {
    if (!a.dentist_id || !a.start_time || !a.end_time) continue;
    const s = new Date(a.start_time);
    const e = new Date(a.end_time);
    const date = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
    (busyByDoc[a.dentist_id] ??= []).push({
      date,
      start: s.getHours() * 60 + s.getMinutes(),
      end: e.getHours() * 60 + e.getMinutes(),
    });
  }

  const activeMembers = (membersQ.data ?? []).filter((m: any) => m.role === "admin" || m.role === "dentist");
  lines.push(`\n# Horários disponíveis (próximos 7 dias)`);
  let totalFreeMinAll = 0;
  const perDocLines: string[] = [];

  for (const m of activeMembers as any[]) {
    const userId = m.user_id;
    const docName = profilesMap.get(userId) ?? "Sem nome";
    const daysOut: string[] = [];
    let docFreeMin = 0;

    for (let i = 0; i < 7; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      if (blocked.has(`${userId}|${dateStr}`)) continue;

      // 1) Override do dia tem prioridade
      const ov = overrides.find((o) => o.user_id === userId && o.work_date === dateStr);
      let baseIntervals: Array<[number, number]> = [];
      let breaks: Array<{ start: string; end: string }> = [];

      if (ov) {
        baseIntervals = [[toMin(ov.start_time), toMin(ov.end_time)]];
        breaks = (ov.breaks ?? []) as any[];
      } else {
        const tpl = templates.find(
          (t) => t.user_id === userId && t.weekday === day.getDay() && t.is_active &&
                 (t.clinic_id === clinicId || t.clinic_id == null),
        );
        if (!tpl) continue;
        baseIntervals = [[toMin(tpl.start_time), toMin(tpl.end_time)]];
        breaks = (tpl.breaks ?? []) as any[];
      }

      // Subtrai pausas
      const breakBusy: Array<[number, number]> = (breaks ?? [])
        .filter((b: any) => b?.start && b?.end)
        .map((b: any) => [toMin(b.start), toMin(b.end)] as [number, number]);
      let intervals = subtractBusy(baseIntervals, breakBusy);

      // Subtrai consultas já marcadas
      const docBusy = (busyByDoc[userId] ?? []).filter((b) => b.date === dateStr);
      let busyArr: Array<[number, number]> = docBusy.map((b) => [b.start, b.end]);

      // Se hoje, subtrai horário já passado
      if (i === 0) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        busyArr.push([0, nowMin]);
      }
      intervals = subtractBusy(intervals, busyArr);

      // Calcula slots SLOT_MIN
      const freeRanges = intervals.filter(([s, e]) => e - s >= SLOT_MIN);
      const dayFreeMin = freeRanges.reduce((sum, [s, e]) => sum + (e - s), 0);
      if (dayFreeMin <= 0) continue;
      docFreeMin += dayFreeMin;

      const label = day.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      const ranges = freeRanges.slice(0, 4).map(([s, e]) => `${fromMin(s)}-${fromMin(e)}`).join(", ");
      const slotCount = Math.floor(dayFreeMin / SLOT_MIN);
      daysOut.push(`  • ${label}: ${slotCount} slots de ${SLOT_MIN}min (${ranges})`);
    }

    if (docFreeMin > 0) {
      totalFreeMinAll += docFreeMin;
      perDocLines.push(`- ${docName} — ${Math.floor(docFreeMin / 60)}h${docFreeMin % 60 ? ` ${docFreeMin % 60}min` : ""} livres`);
      perDocLines.push(...daysOut);
    }
  }

  if (totalFreeMinAll === 0) {
    lines.push(`- Nenhum horário livre detectado (verifique templates de horário em /availability).`);
  } else {
    lines.push(`- Total livre na clínica: ${Math.floor(totalFreeMinAll / 60)}h${totalFreeMinAll % 60 ? ` ${totalFreeMinAll % 60}min` : ""} (slots de ${SLOT_MIN}min)`);
    lines.push(...perDocLines);
  }

  lines.push(`\n# Pacientes`);
  lines.push(`- Total cadastrados: ${patientsCountQ.count ?? 0}`);
  lines.push(`- Inativos (sem consulta há +180 dias): ${inactiveCount}`);

  lines.push(`\n# Desempenho de consultas (últimos 30 dias)`);
  lines.push(`- Total realizadas: ${totalRecent}`);
  lines.push(`- Faltas (no-show): ${noShows} (${noShowRate.toFixed(1)}% de taxa de falta)`);
  if (topProcs.length > 0) {
    lines.push(`- Procedimentos mais feitos:`);
    for (const [name, count] of topProcs) lines.push(`  • ${name}: ${count}x`);
  }

  if (birthdays.length > 0) {
    lines.push(`\n# Aniversariantes de hoje (${birthdays.length})`);
    for (const b of birthdays.slice(0, 10) as any[]) lines.push(`- ${b.full_name}`);
  }

  lines.push(`\n# Financeiro (últimos 30 dias)`);
  lines.push(`- Entradas: ${fmtMoney(entradas)}`);
  lines.push(`- Saídas: ${fmtMoney(saidas)}`);
  lines.push(`- Saldo: ${fmtMoney(entradas - saidas)}`);
  lines.push(`- A receber (pendente): ${fmtMoney(aReceber)}`);
  if (varReceita !== null) {
    const sinal = varReceita >= 0 ? "+" : "";
    lines.push(`- Variação de receita vs. mês anterior: ${sinal}${varReceita.toFixed(1)}% (mês anterior: ${fmtMoney(entradasPrev)})`);
  }

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

    // Folder shared context: include short summary of messages from the FIRST thread
    // of the same folder (excluding the current thread) so conversations in the
    // same folder share context.
    let folderContextBlock = "";
    try {
      const { data: currentThread } = await admin
        .from("ia_gestor_threads")
        .select("folder_id")
        .eq("id", threadId)
        .maybeSingle();
      const folderId = (currentThread as any)?.folder_id as string | null;
      if (folderId) {
        const { data: folder } = await admin
          .from("ia_gestor_folders")
          .select("name")
          .eq("id", folderId)
          .maybeSingle();
        const { data: firstThread } = await admin
          .from("ia_gestor_threads")
          .select("id, title")
          .eq("folder_id", folderId)
          .neq("id", threadId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstThread) {
          const { data: msgs } = await admin
            .from("ia_gestor_messages")
            .select("role, content")
            .eq("thread_id", (firstThread as any).id)
            .order("created_at", { ascending: true })
            .limit(40);
          const lines = (msgs ?? []).map((m: any) =>
            `${m.role === "user" ? "Usuário" : "Você"}: ${String(m.content || "").slice(0, 500)}`
          );
          folderContextBlock = `\n\n--- CONTEXTO DA PASTA "${(folder as any)?.name ?? ""}" ---\n` +
            `As mensagens abaixo são de uma conversa anterior na MESMA pasta. Use-as como contexto compartilhado (assuntos, decisões, preferências do usuário).\n\n` +
            lines.join("\n") +
            `\n--- FIM DO CONTEXTO DA PASTA ---`;
        }
      }
    } catch (e) {
      console.warn("folder context load failed", e);
    }

    const system = `Você é o Gestor IA da clínica ${clinicName}, um copiloto de gestão clínica.

REGRAS DE ESTILO (muito importantes):
- Seja CONCISO por padrão. Respostas curtas, diretas, sem rodeios.
- Use no máximo 2-4 frases quando for uma resposta simples. Só escreva textos longos se a pergunta realmente exigir explicação detalhada.
- Nada de "introduções", "resumos do que vou fazer" ou "conclusões" desnecessárias.
- Use markdown (negrito, listas, tabelas) só quando ajudar de verdade. Evite listas enormes para respostas simples.
- Responda sempre em português, em tom amigável e direto (como ChatGPT).

AÇÕES NO SISTEMA (muito importante):
- Sempre que sua resposta sugerir que o usuário faça algo em outra tela do sistema (cadastrar procedimentos, abrir agenda, ver financeiro, configurar clínica, ver pacientes, etc.), CHAME A TOOL "suggest_actions" com 1 a 4 cards de navegação curtos, em vez de descrever em texto onde ele deve clicar.
- Os cards substituem as instruções textuais "vá em tal menu". Escreva no texto só uma frase curta apresentando, e deixe os cards conduzirem.
- Use rotas reais do sistema. Rotas disponíveis (exemplos): /agenda, /pacientes, /financial, /budgets, /odontogram, /availability, /atendimentos-ia, /secretaria-ia, /tools, /waiting-room, /marketplace, /clinica/medicos, /clinica/aprovacoes.
- IMPORTANTE — para Configurações, SEMPRE aponte para a aba EXATA usando /settings?section=SECAO. Seções válidas:
  • clinic (dados da clínica + horário de funcionamento)
  • procedures (cadastrar/editar procedimentos e preços)
  • insurance (convênios)
  • team (equipe/membros)
  • rooms (salas)
  • specialty (especialidades)
  • subscription (assinatura/plano)
  Ex: para "cadastrar procedimento" use route "/settings?section=procedures"; para "adicionar convênio" use "/settings?section=insurance". NUNCA use só "/settings" sem a seção quando souber qual aba.
- "label" curto (1-4 palavras), "description" curtíssima (uma frase explicando o que fazer lá), "route" sempre começando com "/". Use "icon" opcional dentre: calendar, users, dollar, file, tooth, settings, sparkles, message, map, clock, plus, edit.

IMAGENS:
- Quando o usuário pedir imagem/cartaz/post/logo/ilustração, chame "generate_image" com prompt detalhado em inglês.

USO DOS DADOS:
- Você tem acesso a métricas reais da clínica (no-show, inativos, aniversariantes, comparativo de faturamento, procedimentos mais feitos). Use-os para dar respostas concretas e proativas.
- Se a taxa de no-show estiver alta (>15%), pode sugerir ativar lembretes na Secretária IA.
- Se houver muitos pacientes inativos, pode sugerir uma campanha de retorno.
- Se houver aniversariantes hoje, pode mencioná-los se for relevante.
- Sempre cite números reais dos dados, nunca invente valores.

--- DADOS DA CLÍNICA ---
${contextText}
--- FIM DOS DADOS ---${folderContextBlock}`;

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      messages: modelMessages,
      stopWhen: stepCountIs(50),
      tools: {
        suggest_actions: tool({
          description: "Mostra cards de navegação clicáveis para o usuário ir até uma tela do sistema. Use sempre que sugerir uma ação operacional (cadastrar, configurar, abrir uma página).",
          inputSchema: z.object({
            intro: z.string().optional().describe("Frase curta opcional antes dos cards."),
            actions: z.array(z.object({
              label: z.string().describe("Texto curto do card (1-4 palavras)"),
              description: z.string().describe("Descrição curta (uma frase)"),
              route: z.string().describe("Rota interna começando com /"),
              icon: z.string().optional().describe("Ícone opcional: calendar, users, dollar, file, tooth, settings, sparkles, message, map, clock, plus, edit"),
            })).min(1).max(4),
          }),
          execute: async ({ intro, actions }) => ({ intro: intro ?? null, actions }),
        }),
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