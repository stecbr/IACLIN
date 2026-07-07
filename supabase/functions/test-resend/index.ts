// Diagnostic function: send a test email via Resend and return the raw response.
// Usage: POST { "to": "email@example.com" }
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'IACLIN <noreply@iaclin.com>'

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let to = 'delivered@resend.dev'
  try {
    const body = await req.json()
    if (body?.to) to = body.to
  } catch (_) {}

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'IACLIN — Teste de disparo',
      html: '<p>Este é um teste de envio via Resend.</p>',
      text: 'Este é um teste de envio via Resend.',
    }),
  })

  const text = await res.text()
  return new Response(
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      from_used: FROM,
      to_used: to,
      resend_response: (() => { try { return JSON.parse(text) } catch { return text } })(),
    }, null, 2),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})