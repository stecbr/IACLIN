// Shared helper to send transactional emails via the Resend API directly.
// RESEND_API_KEY is the raw Resend API key (domain iaclin.com verified).

const RESEND_API_URL = 'https://api.resend.com/emails';

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
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = input.from ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'IACLIN <noreply@iaclin.com>';

  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (to.length === 0) return { ok: true, status: 200, body: 'no recipients' };

  const resp = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
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

// Gradient usado no bloco de destaque (ex.: "Horário solicitado").
const HIGHLIGHT_GRADIENT = 'radial-gradient(circle at 0% 0%, #00b8c4, #0f2d52)';
// Fallback sólido para clientes de email que não suportam radial-gradient (Outlook).
const HIGHLIGHT_FALLBACK = '#0f2d52';

// Logo IACLIN hospedada como asset público (usada no cabeçalho do email).
const LOGO_URL = 'https://iaclin.lovable.app/__l5e/assets-v1/de84c8fb-9c0b-437d-97ea-6373d8cb0bd3/logo-iaclin.png';

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
      <div style="margin:22px 0;padding:18px 20px;background:${HIGHLIGHT_FALLBACK};background-image:${HIGHLIGHT_GRADIENT};border-radius:${BRAND.radius};color:#fff;">
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
        <a href="${ctaUrl}" style="display:inline-block;background:${HIGHLIGHT_FALLBACK};color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:13px 26px;border-radius:${BRAND.radius};">${escapeHtml(ctaLabel)}</a>
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
              <td align="center" style="padding:26px 32px 0;text-align:center;">
                <img src="${LOGO_URL}" alt="IACLIN" width="36" height="36" style="display:block;margin:0 auto 8px;width:36px;height:36px;border-radius:10px;" />
                <div style="font-weight:600;font-size:16px;letter-spacing:.12em;font-family:'Jura',${BRAND.font};">
                  <span style="color:#033563;">IA</span><span style="color:#5b6887;">CLIN</span>
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