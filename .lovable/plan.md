
# Migração de Stripe para Mercado Pago

## Contexto
Hoje o IACLIN usa Stripe para:
1. **Assinaturas dos planos da plataforma** (mensal/anual) — funções `stripe-bootstrap-plans`, `stripe-create-checkout`, `stripe-customer-portal`, `stripe-sync-plan`, `stripe-webhook`, tabela `platform_plans` (com `stripe_product_id` / `stripe_price_id`) e `platform_subscriptions` (com `stripe_customer_id` / `stripe_subscription_id`).
2. **Checkout avulso de consulta** — função `create-consultation-checkout` (paciente paga consulta).

Vamos trocar tudo por **Mercado Pago** (assinaturas via "Preapproval / Assinaturas com plano" e pagamentos avulsos via Checkout Pro).

## Pré-requisitos (você precisa providenciar)
Como você não tem acesso à conta do dono, ele precisa enviar (do painel `mercadopago.com.br/developers`, app "Iaclin"):

- `MERCADOPAGO_ACCESS_TOKEN` (produção) — token "Produtivas" da aba Credenciais
- `MERCADOPAGO_ACCESS_TOKEN_TEST` (teste) — token "Teste" (opcional, para sandbox)
- `MERCADOPAGO_WEBHOOK_SECRET` — segredo definido ao cadastrar o webhook em "Notificações > Webhooks"

A **Public Key** do MP é pública e fica no código (não precisa secret).

Eu vou pedir esses 3 segredos via `add_secret` quando você confirmar.

## O que muda

### 1. Banco de dados (migration)
- `platform_plans`: adicionar colunas `mp_preapproval_plan_id text` (id do plano de assinatura no MP) e `mp_payer_email_required boolean default true`. Manter colunas Stripe por compatibilidade (não removo nada agora, só paro de usar).
- `platform_subscriptions`: adicionar `mp_preapproval_id text`, `mp_payer_id text`, `mp_payer_email text`. Manter colunas Stripe.
- Índice em `mp_preapproval_id` para lookup do webhook.

### 2. Edge functions novas
- `mercadopago-bootstrap-plans` — cria/atualiza Preapproval Plans no MP para cada `platform_plans` ativo (admin `iaclin@gmail.com`).
- `mercadopago-sync-plan` — sincroniza um plano específico (substitui `stripe-sync-plan`).
- `mercadopago-create-subscription` — cria preapproval (assinatura) e devolve `init_point` para redirect (substitui `stripe-create-checkout`).
- `mercadopago-cancel-subscription` — cancela a assinatura (equivalente ao customer-portal — MP não tem portal próprio, então faremos UI nossa para "cancelar" e "trocar cartão" via link gerado).
- `mercadopago-webhook` — recebe notificações `preapproval`, `subscription_authorized_payment` e `payment`; atualiza `platform_subscriptions` (status, current_period_end, last_payment_at) e registra pagamentos em `platform_payments` (se existir) ou tabela equivalente.
- `create-consultation-checkout-mp` — substitui `create-consultation-checkout`. Cria Preference (Checkout Pro) e devolve `init_point`.

Funções antigas Stripe ficam no repo mas deixam de ser chamadas pelo front (posso deletá-las depois quando confirmar que MP está OK).

### 3. Front-end
- `src/pages/superadmin/SuperAdminPlans.tsx` (e `PlanFormDialog`): trocar chamadas `stripe-sync-plan` / `stripe-bootstrap-plans` por equivalentes MP. Mostrar `mp_preapproval_plan_id` em vez de `stripe_price_id`.
- Página `/assinatura` (fluxo de assinatura do cliente): trocar `stripe-create-checkout` → `mercadopago-create-subscription`; trocar botão "Gerenciar no portal Stripe" por ações nativas: "Cancelar assinatura" e link do MP para trocar cartão.
- `Financial.tsx` e qualquer outro consumidor de `create-consultation-checkout`: chamar a versão `-mp`.
- Banner/UI: ajustar textos "Stripe" → "Mercado Pago".

### 4. Webhook
- URL: `https://fwyulywxhjyxdreeuqna.supabase.co/functions/v1/mercadopago-webhook` (sem JWT — adicionada em `supabase/config.toml` como `verify_jwt = false`).
- Eventos a habilitar no painel MP: `payment`, `subscription_preapproval`, `subscription_authorized_payment`.
- Validação por header `x-signature` (HMAC SHA256 com `MERCADOPAGO_WEBHOOK_SECRET`).

## Detalhes técnicos importantes

- **Assinaturas MP** funcionam como "Preapproval Plan" (template) + "Preapproval" (assinatura do usuário). A cobrança recorrente roda no MP automaticamente; cancelar = PATCH no preapproval com `status: cancelled`.
- MP **não tem "customer portal"** como Stripe. Para trocar cartão, geramos um novo preapproval ou usamos o link `init_point` do preapproval atual. Para cancelar, chamada direta na API.
- Moeda fixa **BRL**, intervalo `months` (1 ou 12).
- Valor mínimo de assinatura no MP: R$ 2,00.

## Etapas de execução
1. Confirmar plano e pedir os 3 segredos via `add_secret`.
2. Rodar migration (colunas MP).
3. Criar as 6 edge functions acima.
4. Atualizar front (SuperAdminPlans, fluxo de assinatura, Financial).
5. Configurar `verify_jwt=false` para o webhook em `supabase/config.toml`.
6. Rodar `mercadopago-bootstrap-plans` para criar os planos no MP.
7. Te passar a URL do webhook para o dono cadastrar no painel MP.
8. Testar com credenciais de teste; depois ir para produção.

## Fora de escopo agora
- Não removo as funções/colunas Stripe nesta etapa (rollback fácil). Limpeza pode ser feita depois.
- PIX/Boleto avulsos para pacientes continuam fora (decisão do PRD).

Confirma para eu pedir os segredos e começar a implementação?
