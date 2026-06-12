// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `Você é um parser de tabelas de procedimentos odontológicos/médicos de operadoras de saúde no Brasil.
Recebe o conteúdo (CSV ou PDF) de uma tabela com colunas variáveis e devolve uma lista normalizada de procedimentos.
Regras:
- Ignore cabeçalhos, rodapés, legendas e qualquer conteúdo que não seja linha de procedimento.
- "value_brl" = valor que o profissional recebe em reais (R$). Converta strings tipo "R$ 38,50" para número 38.50.
- "value_us" = valor base em US/UCO/UCH (se houver coluna separada). Pode ser null.
- "tuss_code" = código TUSS de 8 dígitos quando presente.
- "charge_type" deve ser um destes: Geral, Dente, Arcada, Hemi-arcada, Sextante, Região.
- "category" deve ser uma destas: Consulta, Diagnóstico, Urgência, Prevenção, Odontopediatria, Dentística Restauradora, Cirurgia Simples, Oral Menor, Periodontia, Endodontia, Prótese, Ortodontia, Geral, Clínica Médica, Cardiologia, Exames, Outros.
- "rx_required" e "photo_required": true se a tabela indicar exigência de RX/foto; false caso contrário.
- "longevity": tempo de garantia/longevidade se informado (ex.: "24 meses"), senão null.
- "plan_coverage": lista de nomes de planos cobertos quando explícito; senão [].
- "observations": qualquer diretriz/observação relevante da linha.
Responda APENAS com JSON válido no formato { "items": [ ... ] }. Sem texto fora do JSON.`;

async function readBody(req: Request) {
  try { return await req.json(); } catch { return null; }
}

function xlsxToCsv(bytes: Uint8Array): string {
  const wb = XLSX.read(bytes, { type: 'array' });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',', blankrows: false });
    parts.push(`# Sheet: ${name}\n${csv}`);
  }
  return parts.join('\n\n');
}

function buildMessages(text: string | null, pdfBase64: string | null, mime: string | null) {
  if (pdfBase64) {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extraia os procedimentos da tabela em anexo (PDF).' },
          { type: 'file', file: { filename: 'table.pdf', file_data: `data:${mime ?? 'application/pdf'};base64,${pdfBase64}` } },
        ],
      },
    ];
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Conteúdo bruto da tabela:\n\n${text ?? ''}` },
  ];
}

function safeJson(raw: string): any {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

const CHARGE = new Set(['Geral', 'Dente', 'Arcada', 'Hemi-arcada', 'Sextante', 'Região']);
const CATS = new Set([
  'Consulta','Diagnóstico','Urgência','Prevenção','Odontopediatria','Dentística Restauradora',
  'Cirurgia Simples','Oral Menor','Periodontia','Endodontia','Prótese','Ortodontia','Geral',
  'Clínica Médica','Cardiologia','Exames','Outros',
]);

function sanitize(items: any[]): any[] {
  return items
    .filter((it) => it && typeof it.procedure_name === 'string' && it.procedure_name.trim().length > 0)
    .map((it, idx) => ({
      procedure_name: String(it.procedure_name).trim(),
      tuss_code: it.tuss_code ? String(it.tuss_code).replace(/\D/g, '').slice(0, 12) || null : null,
      category: CATS.has(it.category) ? it.category : 'Outros',
      charge_type: CHARGE.has(it.charge_type) ? it.charge_type : 'Geral',
      value_us: typeof it.value_us === 'number' ? it.value_us : it.value_us ? Number(String(it.value_us).replace(',', '.')) || null : null,
      value_brl: typeof it.value_brl === 'number' ? it.value_brl : it.value_brl ? Number(String(it.value_brl).replace('.', '').replace(',', '.')) || null : null,
      rx_required: Boolean(it.rx_required),
      photo_required: Boolean(it.photo_required),
      longevity: it.longevity ? String(it.longevity).trim().slice(0, 80) : null,
      observations: it.observations ? String(it.observations).trim().slice(0, 1000) : null,
      plan_coverage: Array.isArray(it.plan_coverage) ? it.plan_coverage.map((p: any) => String(p)).slice(0, 30) : [],
      sort_order: idx,
    }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing auth');

    const body = await readBody(req);
    if (!body) return new Response(JSON.stringify({ error: 'invalid body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { table_id, file_base64, file_name, mime_type } = body as {
      table_id: string; file_base64: string; file_name: string; mime_type: string;
    };
    if (!table_id || !file_base64 || !file_name) {
      return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // User-bound client (RLS) for authorization checks
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: tableRow, error: tableErr } = await userClient
      .from('operator_price_tables').select('id, operator_id').eq('id', table_id).maybeSingle();
    if (tableErr || !tableRow) {
      return new Response(JSON.stringify({ error: 'table not accessible' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
    const lower = file_name.toLowerCase();
    const isPdf = lower.endsWith('.pdf') || (mime_type ?? '').includes('pdf');
    const isSheet = /\.(xlsx|xls|csv|ods)$/i.test(lower);

    let csvText: string | null = null;
    let pdfBase64: string | null = null;
    if (isPdf) {
      pdfBase64 = file_base64;
    } else if (isSheet) {
      csvText = xlsxToCsv(bytes);
      // Cap to avoid blowing the prompt
      if (csvText.length > 180_000) csvText = csvText.slice(0, 180_000);
    } else {
      // try as text
      csvText = new TextDecoder().decode(bytes).slice(0, 180_000);
    }

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: buildMessages(csvText, pdfBase64, mime_type),
        response_format: { type: 'json_object' },
      }),
    });
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: 'AI error', detail: errText.slice(0, 500) }), {
        status: aiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '';
    let parsed: any;
    try { parsed = safeJson(raw); } catch (_) {
      return new Response(JSON.stringify({ error: 'AI returned non-JSON', raw: String(raw).slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rawItems = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    const items = sanitize(rawItems);
    if (items.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, items: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role to insert (RLS guarded above by userClient ownership check)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const payload = items.map((it) => ({ ...it, table_id }));
    const { data: inserted, error: insErr } = await admin
      .from('operator_price_items').insert(payload).select('*');
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ inserted: inserted?.length ?? 0, items: inserted }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});