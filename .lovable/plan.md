## Mudanças

### 1. Aba "Assinatura" dentro de `/settings` com checkout Stripe
Reescrever `src/components/settings/SubscriptionSection.tsx` para incluir:
- Status da assinatura atual + botão "Gerenciar assinatura" (Stripe Customer Portal)
- Cards dos planos (Mensal/Anual) com botão **Assinar** que chama `stripe-create-checkout`
- Histórico de pagamentos (mantém o atual)

Remover rota `/assinatura` → redirect para `/settings`. Deletar `src/pages/Subscription.tsx`.

### 2. Superadmin edita preço/nome/descrição com sync no Stripe
- Nova edge function `stripe-sync-plan` (admin-only) que:
  - Cria/atualiza o `Product` no Stripe (nome + descrição)
  - Se preço mudou: cria novo `Price` (são imutáveis), arquiva o antigo, atualiza `stripe_price_id` no banco
- `PlanFormDialog.tsx`: após salvar no banco, invoca `stripe-sync-plan` e mostra toast de sucesso/erro

### Arquivos
- `src/App.tsx` — remove import + rota de `Subscription`, adiciona redirect
- `src/pages/Subscription.tsx` — deletado
- `src/components/settings/SubscriptionSection.tsx` — reescrito
- `src/components/superadmin/PlanFormDialog.tsx` — chamar sync após salvar
- `supabase/functions/stripe-sync-plan/index.ts` — nova função