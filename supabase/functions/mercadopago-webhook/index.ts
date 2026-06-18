import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { mpFetch, hmacSha256Hex } from '../_shared/mercadopago.ts';

/**
 * Mercado Pago webhook handler.
 * Events handled: payment, subscription_preapproval, subscription_authorized_payment.
 * Signature: header `x-signature` => `ts=...,v1=<hex>` signed over
 *   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (per https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rawBody = await req.text();
  let payload: any = null;
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch { payload = {}; }

  // Signature validation (best-effort; logs but still 200 to avoid retries when secret missing)
  const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  const sigHeader = req.headers.get('x-signature') ?? '';
  const requestId = req.headers.get('x-request-id') ?? '';
  const dataId = String(payload?.data?.id ?? new URL(req.url).searchParams.get('data.id') ?? '');

  if (secret && sigHeader && dataId) {
    try {
      const parts = Object.fromEntries(
        sigHeader.split(',').map((p) => p.trim().split('=').map((s) => s.trim())) as [string, string][],
      );
      const ts = parts.ts;
      const v1 = parts.v1;
      if (ts && v1) {
        const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
        const expected = await hmacSha256Hex(secret, manifest);
        if (expected !== v1) {
          console.warn('MP webhook signature mismatch');
          return new Response('invalid signature', { status: 401 });
        }
      }
    } catch (e) {
      console.warn('MP signature parse error:', e);
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const type: string = payload?.type ?? payload?.topic ?? '';
  const action: string = payload?.action ?? '';

  try {
    if (type === 'preapproval' || action.startsWith('preapproval.')) {
      const preapproval = await mpFetch(`/preapproval/${dataId}`);
      const mpStatus: string = preapproval.status; // authorized | paused | cancelled | pending
      const localStatus =
        mpStatus === 'authorized' ? 'active' :
        mpStatus === 'cancelled' ? 'cancelled' :
        mpStatus === 'paused' ? 'overdue' : 'trial';

      await admin.from('platform_subscriptions')
        .update({
          status: localStatus,
          mp_payer_id: preapproval.payer_id ? String(preapproval.payer_id) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('mp_preapproval_id', dataId);
    } else if (
      type === 'subscription_authorized_payment' ||
      action.startsWith('subscription_authorized_payment') ||
      type === 'payment'
    ) {
      // Try to load payment details
      let preapprovalId: string | null = null;
      let amountCents = 0;
      let paidAt: string | null = null;
      let paymentStatus = 'pending';
      let receiptUrl: string | null = null;

      if (type === 'payment') {
        const p = await mpFetch(`/v1/payments/${dataId}`);
        const ext = String(p.external_reference ?? '');
        if (ext.startsWith('consultation:')) {
          // Handle one-off consultation payment
          const transactionId = ext.split(':')[1];
          if (p.status === 'approved') {
            await admin.from('financial_transactions')
              .update({
                status: 'paid',
                paid_at: p.date_approved ?? new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', transactionId);
          }
          return new Response('ok', { headers: corsHeaders });
        }
        preapprovalId = p.metadata?.preapproval_id ?? p.preapproval_id ?? null;
        amountCents = Math.round(Number(p.transaction_amount ?? 0) * 100);
        paidAt = p.date_approved ?? null;
        paymentStatus = p.status === 'approved' ? 'paid' : (p.status === 'rejected' ? 'failed' : 'pending');
        receiptUrl = p.receipt_url ?? null;
      } else {
        // subscription_authorized_payment
        const sp = await mpFetch(`/authorized_payments/${dataId}`);
        preapprovalId = sp.preapproval_id ?? null;
        amountCents = Math.round(Number(sp.transaction_amount ?? 0) * 100);
        paidAt = sp.payment?.date_approved ?? sp.last_modified ?? null;
        paymentStatus = sp.status === 'processed' ? 'paid' : (sp.status === 'rejected' ? 'failed' : 'pending');
      }

      if (preapprovalId) {
        const { data: sub } = await admin
          .from('platform_subscriptions')
          .select('id')
          .eq('mp_preapproval_id', preapprovalId)
          .maybeSingle();
        if (sub?.id) {
          await admin.from('platform_payments').insert({
            subscription_id: sub.id,
            amount_cents: amountCents,
            method: 'card',
            status: paymentStatus,
            paid_at: paymentStatus === 'paid' ? paidAt : null,
            receipt_url: receiptUrl,
            notes: `MP payment ${dataId}`,
          });
        }
      }
    }
  } catch (e) {
    console.error('MP webhook handler error:', e);
    // return 200 anyway so MP doesn't keep retrying when our DB is broken
  }

  return new Response('ok', { headers: corsHeaders });
});