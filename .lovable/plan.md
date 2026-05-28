
# Ativação de Pagamentos — Stripe BYOK + Planos de Teste

## Decisões assumidas
- **Provedor**: Stripe BYOK (você já criou a conta `iaclin.2026@gmail.com` e tem as 2 chaves). Vou usar a integração que aceita suas próprias chaves, não a nativa da Lovable.
- **Imposto**: Opção 3 (sem automação) — você emite NF e cuida do tributo. Mais simples para começar e zero custo extra. Podemos trocar depois.
- **Modo inicial**: Test mode (chaves `sk_test_...`). Quando validar, troca para `sk_live_...`.
- **Catálogo**: 2 planos de teste, ambos genéricos "Plano IACLIN", sem segmentação clínica/profissional/operadora ainda — só para validar o fluxo de cobrança ponta a ponta.

## Planos a criar

| Plano | Ciclo | Valor | Stripe Price ID |
|---|---|---|---|
| IACLIN Mensal (Teste) | mensal | R$ 99,99 | gerado na criação |
| IACLIN Anual (Teste) | anual | R$ 859,99 | gerado na criação |

Os preços serão criados **diretamente no Stripe via API** dentro de uma edge function de bootstrap, e os IDs gravados na tabela `platform_plans` que já existe.

## O que vou fazer (passos)

### 1. Guardar suas credenciais
- `STRIPE_SECRET_KEY` (a `sk_test_...`) — via secrets tool, te peço para colar no formulário seguro.
- `STRIPE_PUBLISHABLE_KEY` (a `pk_test_...`) — pode ir no `.env` como `VITE_STRIPE_PUBLISHABLE_KEY` (é pública).
- `STRIPE_WEBHOOK_SECRET` — adiciono depois do passo 4 (você copia do Stripe Dashboard).

### 2. Bootstrap dos planos no Stripe
Edge function `stripe-bootstrap-plans` (chamada manualmente uma vez):
- Cria Product "IACLIN Mensal (Teste)" + Price R$99,99/mês.
- Cria Product "IACLIN Anual (Teste)" + Price R$859,99/ano.
- Insere/atualiza linhas em `platform_plans` com `stripe_product_id` e `stripe_price_id`.

### 3. Checkout
Edge function `stripe-create-checkout`:
- Recebe `plan_id` + usuário autenticado.
- Cria/recupera `Customer` no Stripe (salva `stripe_customer_id` na `platform_subscriptions`).
- Cria `Checkout Session` em modo `subscription`.
- Retorna URL para redirecionar.

### 4. Webhook
Edge function `stripe-webhook` (com `verify_jwt = false` e validação de assinatura):
- `checkout.session.completed` → cria/ativa `platform_subscriptions`.
- `invoice.paid` → insere `platform_payments` + estende `current_period_end`.
- `invoice.payment_failed` → marca como `overdue`.
- `customer.subscription.updated` / `.deleted` → sincroniza status.

Depois de criar, te passo a URL do webhook (`https://fwyulywxhjyxdreeuqna.supabase.co/functions/v1/stripe-webhook`) para você colar no Stripe Dashboard → Developers → Webhooks, e copiar o `whsec_...` resultante.

### 5. Portal do cliente
Edge function `stripe-customer-portal`:
- Gera link do Stripe Billing Portal (cancelar, trocar cartão, ver faturas).

### 6. Tela de assinatura (UI)
Página `/assinatura` (ou bloco em `SettingsPage`):
- Lista os 2 planos com preço.
- Botão "Assinar" → chama `stripe-create-checkout`.
- Se já tem assinatura ativa: mostra status, próximo vencimento, botão "Gerenciar" (abre portal).

## O que você precisa fazer

1. **Agora**: colar a `sk_test_...` no formulário de secret que vou abrir.
2. **Depois do passo 4**: criar o webhook no Stripe Dashboard com a URL que te passo e colar o `whsec_...`.
3. **Validar**: fazer um checkout de teste com cartão `4242 4242 4242 4242` (qualquer CVC/data futura).

## Fora do escopo desta entrega
- Cupons de desconto (já tem modelo no banco, fica para depois).
- Segmentação clínica / profissional / operadora nos planos.
- Notas fiscais / integração contábil.
- Modo live (chaves `sk_live_`) — você ativa quando quiser, é só trocar o valor da secret.

## Detalhes técnicos
- SDK: `npm:stripe@^17` nas edge functions.
- Tabelas usadas (já existem): `platform_plans`, `platform_subscriptions`, `platform_payments`.
- CORS configurado em todas as funções chamadas do browser.
- `stripe-webhook` precisa de `verify_jwt = false` no `supabase/config.toml`.

**Posso seguir? Se sim, ao aprovar este plano eu já te peço a `STRIPE_SECRET_KEY` no primeiro passo.**
