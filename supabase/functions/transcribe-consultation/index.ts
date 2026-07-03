import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const STRUCTURED_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    chief_complaint: { type: 'string' },
    history_present_illness: { type: 'string' },
    symptom_duration_value: { type: 'string' },
    symptom_duration_unit: { type: 'string' },
    physical_exam: { type: 'string' },
    diagnosis: { type: 'string' },
    severity: { type: 'string' },
    treatment_plan: { type: 'string' },
    follow_up_reason: { type: 'string' },
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, cid10: { type: 'string' } },
        required: ['text'],
      },
    },
    soap: {
      type: 'object',
      properties: { s: { type: 'string' }, o: { type: 'string' }, a: { type: 'string' }, p: { type: 'string' } },
    },
    anamnesis: {
      type: 'object',
      properties: {
        allergies: { type: 'string' },
        medications: { type: 'string' },
        surgeries: { type: 'string' },
        family_history: { type: 'string' },
        social_history: { type: 'string' },
      },
    },
    requests: {
      type: 'object',
      properties: {
        prescription: { type: 'object', additionalProperties: { type: 'string' } },
        exam: { type: 'object', additionalProperties: { type: 'string' } },
        certificate: { type: 'object', additionalProperties: { type: 'string' } },
        referral: { type: 'object', additionalProperties: { type: 'string' } },
      },
    },
    vital_signs: {
      type: 'object',
      properties: {
        bp_sys:   { type: 'string' },
        bp_dia:   { type: 'string' },
        hr:       { type: 'string' },
        rr:       { type: 'string' },
        temp:     { type: 'string' },
        spo2:     { type: 'string' },
        weight:   { type: 'string' },
        height:   { type: 'string' },
        glycemia: { type: 'string' },
      },
    },
    procedures_mentioned: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name:  { type: 'string' },
          price: { type: 'number' },
        },
        required: ['name'],
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: rec, error: recErr } = await admin
      .from('consultation_recordings').select('*').eq('id', recording_id).single();
    if (recErr || !rec) throw new Error(recErr?.message || 'recording not found');
    if (!rec.audio_storage_path) throw new Error('audio_storage_path missing');

    await admin.from('consultation_recordings').update({ status: 'processing', error_message: null }).eq('id', recording_id);

    // Download audio + base64
    const { data: file, error: dlErr } = await admin.storage.from('consultation-audio').download(rec.audio_storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message || 'failed to download audio');
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);
    const mimeType = file.type || 'audio/webm';

    const systemPrompt = `Você é um assistente clínico especializado em transcrever e estruturar consultas médicas/odontológicas em português do Brasil.
1) Gere a TRANSCRIÇÃO completa fiel ao áudio (campo "transcript").
2) Gere os demais campos clínicos com base no que foi dito. Se algo não foi mencionado, deixe vazio.
3) Para "hypotheses", use frases curtas (ex: "Cefaleia tensional"). Se conhecer, inclua "cid10".
4) Para "soap": S=subjetivo, O=objetivo, A=avaliação, P=plano.
5) NÃO invente dados que não estejam no áudio.
6) Para "vital_signs": extraia APENAS valores mencionados explicitamente. Exemplos: "pressão 120 por 80" → bp_sys="120", bp_dia="80"; "frequência cardíaca 72" → hr="72"; "temperatura 36.5" → temp="36.5"; "saturação 98" → spo2="98"; "peso 70 quilos" → weight="70"; "altura 1 metro 70" → height="170"; "glicemia 90" → glycemia="90". Deixe vazio se não mencionado.
7) Para "procedures_mentioned": liste procedimentos realizados ou citados durante a consulta (ex: "consulta de retorno", "extração do dente 26", "limpeza dental", "curativo"). Se um preço/valor for mencionado pelo profissional, inclua em "price". Deixe o array vazio se nenhum procedimento específico for citado além da consulta em si.`;

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
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcreva e estruture esta consulta. Retorne JSON com transcript + campos clínicos.' },
              { type: 'input_audio', input_audio: { data: base64, format: mimeType.includes('webm') ? 'webm' : 'wav' } },
            ],
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'save_consultation',
            description: 'Salva a transcrição estruturada da consulta',
            parameters: {
              type: 'object',
              properties: { transcript: { type: 'string' }, ...STRUCTURED_SCHEMA.properties },
              required: ['transcript'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'save_consultation' } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) throw new Error('Limite de requisições atingido. Tente novamente em instantes.');
      if (aiRes.status === 402) throw new Error('Créditos esgotados. Adicione créditos no workspace.');
      throw new Error(`AI Gateway ${aiRes.status}: ${txt}`);
    }
    const aiJson = await aiRes.json();
    const call = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error('AI did not return structured output');
    const args = JSON.parse(call.function.arguments);

    const { error: updErr } = await admin
      .from('consultation_recordings')
      .update({
        status: 'done',
        transcript: args.transcript ?? null,
        summary: args.summary ?? null,
        hypotheses: args.hypotheses ?? null,
        soap: args.soap ?? null,
        anamnesis: args.anamnesis ?? null,
        structured: args,
      })
      .eq('id', recording_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, result: args }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = (err as Error).message;
    try {
      const { recording_id } = await req.clone().json().catch(() => ({}));
      if (recording_id) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        await admin.from('consultation_recordings')
          .update({ status: 'failed', error_message: message }).eq('id', recording_id);
      }
    } catch {/* noop */}
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});