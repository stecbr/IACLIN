
## Objetivo

Adicionar um sistema completo de **planos de assinatura** (mensal e anual) gerenciado pelo superadmin, com cobrança via **Stripe (cartão)** e registro manual de **PIX**, suporte a **descontos** (manuais e cupons) e visualização do status de pagamento em todas as pontas (superadmin, clínica, médico, operadora).

---

## 1. Modelo de dados (novas tabelas)

```text
platform_plans                    catálogo único de planos
 ├ id, name, segment              segment: clinic|doctor|operator
 ├ billing_cycle                  monthly | yearly
 ├ price_cents, currency (BRL)
 ├ stripe_price_id (nullable)     vincula ao Price do Stripe
 ├ features (jsonb), is_active

platform_coupons                  cupons reutilizáveis
 ├ code (unique), description
 ├ discount_type (percent|fixed), discount_value
 ├ valid_from, valid_until, max_uses, uses_count, is_active

platform_subscriptions            (já existe — estender)
 + plan_id (fk platform_plans)
 + billing_cycle
 + payment_method (card|pix|manual)
 + discount_type, discount_value, coupon_id (manual OU cupom)
 + final_amount_cents              valor após desconto
 + stripe_customer_id, stripe_subscription_id
 + current_period_end              data fim da assinatura
 + last_payment_at, last_payment_method

platform_payments                 histórico de cada cobrança
 ├ subscription_id, amount_cents
 ├ method (card|pix), status (paid|pending|failed|refunded)
 ├ paid_at, due_date
 ├ stripe_invoice_id (nullable)
 ├ notes, recorded_by (uuid)      quem registrou (para PIX manual)
```

Todas com RLS: superadmin (`iaclin@gmail.com`) gerencia tudo; cliente lê apenas a própria assinatura via `entity_id`.

---

## 2. Painel Superadmin

**Nova aba `/superadmin/plans`**
- CRUD de planos: nome, segmento, ciclo, preço, features, ativar/desativar
- Botão "Sincronizar com Stripe" cria/atualiza Product+Price no Stripe

**Nova aba `/superadmin/coupons`**
- CRUD de cupons (código, %/R$, validade, limite de usos)

**Telas existentes `SuperAdminClinics` / `SuperAdminDoctors` / `SuperAdminOperators`**
- `SubscriptionDialog` reformulado:
  - Selecionar **plano do catálogo** (filtrado por segmento)
  - Selecionar **ciclo** (mensal/anual) e **forma de pagamento padrão**
  - Aplicar **desconto manual** (% ou R$) ou **cupom**
  - Mostra valor final calculado
  - Campo data de vencimento + observações
- Botão "Registrar pagamento PIX" abre dialog rápido para criar `platform_payments` (data, valor, comprovante opcional) e empurra `current_period_end`

**Nova aba `/superadmin/payments` (status geral)**
- Tabela com todas as assinaturas + último pagamento + próximo vencimento
- Badges: Em dia, Vence em X dias, Atrasado, Cancelado
- Filtros por segmento, status, método, período
- Export CSV

---

## 3. Tela do cliente (Clínica / Médico / Operadora)

Nova seção em **Configurações → Assinatura** (`SettingsPage` e `OperatorSettings`):
- Card "Plano atual": nome, ciclo, valor, próximo vencimento, status
- Histórico de pagamentos (últimos 12)
- Botão **"Trocar plano"** → modal lista planos ativos do segmento; ao escolher gera solicitação que o superadmin aprova (registro em `platform_subscription_changes`, opcional simples) **e**, se cartão, redireciona para Stripe Checkout
- Botão **"Alterar forma de pagamento"** (cartão ↔ PIX); cartão abre Stripe Customer Portal
- Aviso de vencimento próximo / inadimplência

---

## 4. Integração Stripe

Pré-requisito: usar **`enable_stripe_payments`** (built-in da Lovable, sem chave do usuário).

Edge functions a criar:
- `create-checkout-session` — cria sessão de assinatura para o plano escolhido
- `create-customer-portal` — gera URL do portal Stripe (trocar cartão / cancelar)
- `stripe-webhook` — escuta `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`; atualiza `platform_subscriptions` e insere em `platform_payments`
- `sync-plan-to-stripe` — superadmin: cria/atualiza Product+Price quando edita um plano

PIX continua 100% manual: superadmin clica "Registrar pagamento PIX" → cria linha em `platform_payments` e estende `current_period_end`.

---

## 5. Cálculo do valor final

```text
base = plan.price_cents
if coupon: desconto = coupon.discount_value (%/R$)
elif desconto manual: usa desconto da assinatura
final_amount_cents = base - desconto (>=0)
```
Função SQL `calc_subscription_amount(subscription_id)` para reuso.

---

## 6. Detalhes técnicos

- **Tipos**: estender `src/types/superadmin.ts` com `PlatformPlan`, `PlatformCoupon`, `PlatformPayment`, novos campos de `PlatformSubscription`.
- **Edge function `platform-admin-data`**: novos `type=plans|coupons|payments|payment-status`.
- **RPC `upsert_platform_subscription`**: aceitar `plan_id`, `billing_cycle`, `payment_method`, `discount_*`, `coupon_id`.
- **Trigger**: ao inserir `platform_payments` com `status=paid`, atualizar `last_payment_at` + recalcular `current_period_end` (+1 mês ou +1 ano).
- **Segurança**: webhook do Stripe valida assinatura via `STRIPE_WEBHOOK_SECRET`; demais funções verificam JWT do superadmin.
- **Secrets necessários**: serão criados automaticamente pelo `enable_stripe_payments` (não pedir manualmente).

---

## 7. Ordem de implementação

1. Migration: tabelas `platform_plans`, `platform_coupons`, `platform_payments` + colunas novas em `platform_subscriptions` + RLS/GRANTs + função de cálculo + trigger de período
2. Habilitar Stripe (`enable_stripe_payments`) + criar edge functions de checkout/portal/webhook/sync
3. Painel superadmin: planos, cupons, pagamentos
4. `SubscriptionDialog` reformulado + dialog de registrar PIX
5. Tela do cliente: seção Assinatura em Settings (clinic/doctor) e OperatorSettings
6. Badges de vencimento + notificações de inadimplência

Confirma esse plano para eu implementar?
