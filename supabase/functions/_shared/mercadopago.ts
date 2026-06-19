const MP_BASE = 'https://api.mercadopago.com';

export function getPaymentMode(): 'live' | 'test' {
  const raw = (Deno.env.get('PAYMENT_MODE') ?? 'live').toLowerCase().trim();
  return raw === 'test' ? 'test' : 'live';
}

export function getMpToken(): string {
  const mode = getPaymentMode();
  const envName = mode === 'live' ? 'MERCADOPAGO_ACCESS_TOKEN' : 'MERCADOPAGO_ACCESS_TOKEN_TEST';
  const token = Deno.env.get(envName);
  if (!token) {
    throw new Error(
      `Mercado Pago: segredo ${envName} não está configurado (PAYMENT_MODE=${mode}).`,
    );
  }
  const isLive = token.startsWith('APP_USR-');
  const isTest = token.startsWith('TEST-');
  if (mode === 'live' && !isLive) {
    throw new Error(
      `Mercado Pago: PAYMENT_MODE=live exige token de produção (APP_USR-...). ` +
        `Recebido prefixo "${token.slice(0, 8)}" em ${envName}. ` +
        `Troque o valor do segredo ou defina PAYMENT_MODE=test.`,
    );
  }
  if (mode === 'test' && !isTest) {
    throw new Error(
      `Mercado Pago: PAYMENT_MODE=test exige token de teste (TEST-...). ` +
        `Recebido prefixo "${token.slice(0, 8)}" em ${envName}.`,
    );
  }
  console.log(`[mercadopago] mode=${mode} token_prefix=${token.slice(0, 10)}`);
  return token;
}

export async function mpFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<any> {
  const token = init.token ?? getMpToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${MP_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  if (!res.ok) {
    const msg = json?.message || json?.error || text || `MP HTTP ${res.status}`;
    throw new Error(`MercadoPago ${res.status}: ${msg}`);
  }
  return json;
}

/** HMAC-SHA256 hex for webhook signature validation */
export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}