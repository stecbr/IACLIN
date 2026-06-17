## Objetivo

Criar planos para o segmento **Clínica** com limite de profissionais incluídos e cobrança por profissional excedente.

## 1. Mudança no banco (migration)

Adicionar 2 colunas em `public.platform_plans`:

- `max_professionals` (integer, nullable) — quantidade de profissionais incluídos no plano. `NULL` = ilimitado.
- `extra_professional_price_cents` (integer, nullable) — valor cobrado por profissional adicional acima do limite. `NULL` = não permite excedente.

Sem mudanças em RLS (a tabela já tem políticas de superadmin).

## 2. Planos iniciais (segmento Clínica, mensal)

| Plano       | Profissionais inclusos | Mensalidade   | Excedente por profissional |
| ----------- | ---------------------- | ------------- | -------------------------- |
| Essencial   | 10                     | R$ 599,00     | R$ 100,00                  |
| Plus        | 15                     | R$ 849,00     | R$ 100,00                  |
| Pro         | 20                     | R$ 1.099,00   | R$ 100,00                  |
| Avançado    | 30                     | R$ 1.499,00   | R$ 100,00                  |
| Enterprise  | 50                     | R$ 2.199,00   | R$ 100,00                  |

Recursos listados em todos: agenda, prontuário, financeiro, WhatsApp, marketplace etc. (replicados via `features`).

**Confirma esses preços?** Se quiser outros valores eu ajusto antes de aplicar a migração.

## 3. UI — SuperAdmin → Planos

**`PlanFormDialog`**: adicionar 2 campos quando o segmento for "Clínica":
- "Profissionais incluídos" (numérico, vazio = ilimitado)
- "Valor por profissional excedente (R$)" (numérico, vazio = não permite excedente)

**`SuperAdminPlans.tsx`** (lista de planos): cada card mostra um badge "10 profissionais · +R$ 100/extra".

## 4. Fora de escopo agora

- Cobrança automática do excedente (apenas exibido; faturamento real fica para depois).
- Planos para médico/dentista solo e operadora (usuário pediu só clínica).
- Mudanças em assinaturas existentes ou fluxo de checkout Stripe (o `stripe-sync-plan` continua sincronizando preço base; excedente fica como item separado depois).

## 5. Detalhes técnicos

- Seed via `INSERT ... ON CONFLICT DO NOTHING` usando `name + segment + billing_cycle` (vou criar índice único auxiliar).
- Tipos do Supabase regerados após a migração; depois ajusto `src/types/superadmin.ts` para incluir os 2 novos campos.
