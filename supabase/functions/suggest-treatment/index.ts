import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const SCHEMA = {
  type: 'object',
  properties: {
    medications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          medication:    { type: 'string' },
          concentration: { type: 'string' },
          dosage:        { type: 'string' },
          duration:      { type: 'string' },
          route:         { type: 'string' },
          controlled:    { type: 'boolean' },
          justification: { type: 'string' },
        },
        required: ['medication'],
      },
    },
    treatment_suggestions: {
      type: 'array',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
  required: ['medications', 'treatment_suggestions'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { chief_complaint, hypotheses, diagnosis, specialty } = await req.json();

    const hypothesesText = Array.isArray(hypotheses)
      ? hypotheses.map((h: any) => h.text || String(h)).filter(Boolean).join(', ')
      : (hypotheses || '');

    const context = [
      chief_complaint && `Queixa principal: ${chief_complaint}`,
      hypothesesText && `Hipóteses diagnósticas: ${hypothesesText}`,
      diagnosis && `Diagnóstico: ${diagnosis}`,
      specialty && `Especialidade: ${specialty}`,
    ].filter(Boolean).join('\n');

    if (!context.trim()) {
      return new Response(
        JSON.stringify({ error: 'Informe queixa, hipóteses ou diagnóstico antes de pedir sugestões.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const systemPrompt = `Você é um assistente clínico de apoio à decisão para médicos e dentistas no Brasil.
Com base no contexto clínico fornecido, sugira:
1. Medicamentos apropriados (campo "medications"): para cada medicamento, informe nome genérico, concentração, posologia, duração, via de administração (route: "oral", "tópico", "inalatório", "IV", "sublingual"), se é controlado (controlled: true/false) e uma breve justificativa (justification).
2. Condutas não farmacológicas (campo "treatment_suggestions"): orientações ao paciente, medidas gerais, repouso, dieta, acompanhamento, etc. Cada item é uma string separada no array.
3. Campo "notes": alertas importantes, contraindicações relevantes ou observações gerais (string única, pode ser vazio).

IMPORTANTE: Estas são SUGESTÕES de apoio à decisão clínica. O profissional de saúde deve sempre avaliar o caso específico e sua experiência. Baseie-se APENAS no contexto fornecido, sem inventar diagnósticos.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Contexto clínico:\n${context}\n\nSugira medicamentos e conduta adequados.` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_treatment',
            description: 'Retorna sugestões estruturadas de medicamentos e conduta clínica',
            parameters: SCHEMA,
          },
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_treatment' } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) throw new Error('Limite de requisições atingido. Tente novamente em instantes.');
      if (aiRes.status === 402) throw new Error('Créditos esgotados no gateway de IA.');
      throw new Error(`AI Gateway ${aiRes.status}: ${txt}`);
    }

    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error('IA não retornou sugestões estruturadas.');
    const result = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = (err as Error).message;
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
