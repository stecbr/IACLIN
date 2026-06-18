const MP_BASE = 'https://api.mercadopago.com';

export function getMpToken(useTest = false): string {
  const live = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  const test = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_TEST');
  if (useTest && test) return test;
  if (live) return live;
  if (test) return test;
  throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured');
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