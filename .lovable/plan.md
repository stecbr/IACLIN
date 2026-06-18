## Problema

A função `mercadopago-sync-plan` (e demais funções MP) usa `getMpToken()` em `_shared/mercadopago.ts`, que hoje escolhe o token assim:

1. Se `useTest=true` e existir `MERCADOPAGO_ACCESS_TOKEN_TEST`, usa teste.
2. Senão, prefere `MERCADOPAGO_ACCESS_TOKEN` (produção).
3. Como fallback, usa o de teste.

Nenhuma função passa `useTest`, então sempre cai no token de produção — mas o back_url/preapproval pode estar sendo enviado com dados/URLs que o MP interpreta como teste, ou o token salvo em `MERCADOPAGO_ACCESS_TOKEN` é na verdade um token `TEST-...`, gerando o erro **"Cannot test production applications" / local_payment_not_conducted**.

Esse erro do MP sempre significa: o token enviado não bate com o tipo da aplicação MP (aplicação produtiva recebeu token de teste, ou vice-versa).

## Solução

Adicionar um modo de pagamento explícito + validação de prefixo do token nas funções Mercado Pago.

### 1. Novo segredo `PAYMENT_MODE`
Pedir via `add_secret`:
- `PAYMENT_MODE` = `"live"` (produção) ou `"test"` (sandbox). Default no código: `"live"`.

### 2. Ajustar `supabase/functions/_shared/mercadopago.ts`
Refatorar `getMpToken()` para:

- Ler `PAYMENT_MODE` (default `"live"`).
- Se `live` → exigir `MERCADOPAGO_ACCESS_TOKEN` começando com `APP_USR-`.
- Se `test` → exigir `MERCADOPAGO_ACCESS_TOKEN_TEST` começando com `TEST-`.
- Se o prefixo não bater, lançar erro claro: `"PAYMENT_MODE=live exige token APP_USR-..., recebido prefixo X. Confira o segredo MERCADOPAGO_ACCESS_TOKEN."`.
- Logar apenas `mode` e os primeiros 10 chars do token (nunca o token inteiro).
- Remover o parâmetro `useTest` (não é mais necessário — o modo é global e explícito).

### 3. Atualizar chamadas
- `mercadopago-sync-plan/index.ts`, `mercadopago-create-subscription/index.ts`, `mercadopago-cancel-subscription/index.ts`, `mercadopago-webhook/index.ts`, `create-consultation-checkout-mp/index.ts`: continuam chamando `mpFetch(...)` normalmente — a refatoração é interna ao helper. Adicionar um `console.log` inicial em cada uma com `PAYMENT_MODE` para facilitar diagnóstico.

### 4. Validação manual após deploy
1. Confirmar com o dono qual token está em `MERCADOPAGO_ACCESS_TOKEN`:
   - Começa com `APP_USR-` → manter `PAYMENT_MODE=live`.
   - Começa com `TEST-` → ou trocar o valor do segredo para o token produtivo (`APP_USR-`), ou setar `PAYMENT_MODE=test` e usar `MERCADOPAGO_ACCESS_TOKEN_TEST`.
2. Reabrir o plano de R$ 20,00 no SuperAdmin e clicar Salvar → deve sincronizar sem erro 400.

## Fora de escopo
- Não mexo no fluxo de assinatura/checkout do cliente nesta etapa — só na seleção de credencial.
- Não removo as funções Stripe.

Confirma para eu pedir o segredo `PAYMENT_MODE` e aplicar as mudanças?
