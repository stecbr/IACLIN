## Mudanças

### 1. Remover status "Em Negociação" dos orçamentos
Arquivo: `src/components/budgets/BudgetDetailDialog.tsx`
- Remover a opção `{ value: 'negotiating', label: 'Em Negociação' }` da lista de status.
- Remover a entrada `negotiating` do mapa de cores de status.
- Remover o texto de aviso que menciona "Em negociação" (linha ~135) ou substituir por "Pendente".

Arquivo: `src/components/budgets/BudgetCard.tsx`
- Remover a entrada `negotiating: 'before:bg-blue-400'` do mapa de cores.

Observação: o Kanban em `Budgets.tsx` já só usa `pending`, `approved`, `lost` — nada a mudar lá. Registros antigos com status `negotiating` (se existirem) continuam no banco mas caem no fallback "pending" do Kanban; não vamos migrar dados a menos que você peça.

### 2. Corrigir campo "Valor (R$)" mostrando "0120"
Arquivo: `src/components/budgets/BudgetFormDialog.tsx`

Causa: quando o procedimento selecionado tem `default_price = 0`, o autofill grava `"0"` no campo. Ao o usuário digitar `120` na frente, o input fica `"0120"`.

Correção:
- No autofill (linha ~190), só preencher `updated.price` quando `proc.default_price > 0`; caso contrário, deixar string vazia.
- No `onChange` do input de preço, normalizar removendo zeros à esquerda (ex.: `value.replace(/^0+(?=\d)/, '')`) antes de salvar no state, preservando `""` e `"0"` isolado.

Nenhuma outra alteração.