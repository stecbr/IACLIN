// Shared helper to send transactional emails via the Lovable connector gateway (Resend).
// Uses the "iaclin" API key (domain iaclin.com) with sending-only access.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendResendEmail(input: SendEmailInput): Promise<{ ok: boolean; status: number; body: string }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = input.from ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'IACLIN <noreply@iaclin.com>';

  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured (Resend connector missing)');

  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (to.length === 0) return { ok: true, status: 200, body: 'no recipients' };

  const resp = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo,
      tags: input.tags,
    }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    console.error(`[resend] send failed [${resp.status}]:`, body);
  }
  return { ok: resp.ok, status: resp.status, body };
}

// ---------- Brand primitives (IACLIN visual identity) ----------

const BRAND = {
  primary: '#1E5AC7',     // IACLIN blue
  primaryDark: '#0F3E92',
  bg: '#F5F7FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  accent: '#10B981',
  danger: '#DC2626',
  radius: '14px',
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

export function renderBrandedEmail(opts: {
  preheader?: string;
  title: string;
  intro?: string;
  rows?: { label: string; value: string }[];
  highlightBox?: { label?: string; value: string };
  notes?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  clinicName?: string;
}): string {
  const {
    preheader = '',
    title,
    intro = '',
    rows = [],
    highlightBox,
    notes,
    ctaLabel,
    ctaUrl,
    footerNote,
    clinicName,
  } = opts;

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};width:38%;vertical-align:top;">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.text};font-weight:500;">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join('');

  const highlightHtml = highlightBox
    ? `
      <div style="margin:22px 0;padding:18px 20px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});border-radius:${BRAND.radius};color:#fff;">
        ${highlightBox.label ? `<div style="font-size:12px;opacity:.85;letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(highlightBox.label)}</div>` : ''}
        <div style="font-size:20px;font-weight:600;line-height:1.3;">${escapeHtml(highlightBox.value)}</div>
      </div>`
    : '';

  const notesHtml = notes
    ? `
      <div style="margin:20px 0;padding:14px 16px;background:#FFF7ED;border-left:3px solid #F59E0B;border-radius:8px;">
        <div style="font-size:12px;font-weight:600;color:#92400E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Observações do paciente</div>
        <div style="font-size:14px;color:${BRAND.text};line-height:1.5;white-space:pre-wrap;">${escapeHtml(notes)}</div>
      </div>`
    : '';

  const ctaHtml = ctaLabel && ctaUrl
    ? `
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:${BRAND.radius};">${escapeHtml(ctaLabel)}</a>
      </div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.font};color:${BRAND.text};">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:${BRAND.card};border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.06);">
            <tr>
              <td style="padding:26px 32px 0;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});display:inline-block;text-align:center;line-height:34px;color:#fff;font-weight:700;font-size:15px;">IA</div>
                  <div style="font-weight:700;font-size:15px;letter-spacing:.3px;color:${BRAND.text};">IACLIN</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 8px;">
                <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:600;color:${BRAND.text};">${escapeHtml(title)}</h1>
                ${clinicName ? `<div style="font-size:13px;color:${BRAND.muted};margin-bottom:10px;">${escapeHtml(clinicName)}</div>` : ''}
                ${intro ? `<p style="margin:0;font-size:14px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(intro)}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                ${highlightHtml}
                ${rowsHtml ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>` : ''}
                ${notesHtml}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 30px;">
                ${footerNote ? `<p style="margin:16px 0 0;font-size:12px;color:${BRAND.muted};line-height:1.5;">${escapeHtml(footerNote)}</p>` : ''}
                <p style="margin:18px 0 0;font-size:11px;color:${BRAND.muted};text-align:center;">Enviado por IACLIN · Gestão inteligente para clínicas</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}