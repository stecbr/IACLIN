## Problema

Clicar em "Excluir" no modal de orçamento não remove nada. A causa é RLS: as tabelas `treatment_plans` e `treatment_plan_items` têm policies de SELECT/INSERT/UPDATE, mas **nenhuma policy de DELETE**. Sem policy, o Postgres bloqueia silenciosamente o delete e o `supabase-js` não lança erro — então o `onSuccess` roda e o usuário vê "Orçamento excluído" mesmo sem nada ser apagado.

## Correção

### 1. Migração — adicionar policies de DELETE

Criar duas policies espelhando o padrão das existentes (membros da clínica do paciente podem deletar; quando `patients.clinic_id` é nulo, o dono pessoal pode deletar):

- `treatment_plans` — DELETE permitido se o usuário pertence à clínica do paciente vinculado, ou se é o `dentist_id` quando o orçamento é pessoal (sem clínica).
- `treatment_plan_items` — DELETE permitido se o usuário pode deletar o `treatment_plan` pai.

### 2. Reforço no código (`BudgetDetailDialog.tsx`)

Para detectar futuras falhas silenciosas, alterar a mutation para usar `.select()` no delete e checar se retornou alguma linha — se vier vazio, lançar erro em vez de mostrar sucesso. Mudança pequena, apenas no `deletePlan.mutationFn`.

## Arquivos afetados

- nova migração SQL (policies de DELETE)
- `src/components/budgets/BudgetDetailDialog.tsx` (validação pós-delete)

Sem mudanças em UI/UX.
