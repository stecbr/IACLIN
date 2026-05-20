## Problemas identificados em `/budgets`

1. **Clique no card de orçamento não abre nada**
   - `src/components/budgets/BudgetCard.tsx` não possui `onClick` e a página `Budgets.tsx` não renderiza nenhum dialog de detalhe. Só existe o `BudgetFormDialog` (criar novo).
2. **Drag-and-drop não move o card entre colunas**
   - Em `src/pages/Budgets.tsx`, as colunas são `<div id={col.id}>` simples. Elas **não** são registradas com `useDroppable` do `@dnd-kit/core`, então `closestCenter` só detecta os próprios cards. Resultado: arrastar para uma coluna vazia, ou soltar no "espaço" entre cards, não dispara `onDragEnd` com um `over` válido → o status não muda.

## Correções

### 1. Tornar cada coluna dropável
Criar um pequeno componente `KanbanColumn` (no próprio `Budgets.tsx` ou em `src/components/budgets/KanbanColumn.tsx`) que:
- Usa `useDroppable({ id: col.id })`.
- Aplica `setNodeRef` no wrapper da coluna.
- Aplica um leve realce visual (ring/bg) quando `isOver` for true.
- Recebe os cards como `children` mantendo o `SortableContext` atual.

Em `handleDragEnd`, manter a lógica já existente: se `over.id` é uma coluna → muda status; se é outro card → usa o status daquele card. Já está correta; só passa a funcionar quando a coluna é droppable.

### 2. Abrir detalhes ao clicar no card
Criar `src/components/budgets/BudgetDetailDialog.tsx` (estilo Apple/iOS, fade-in, sem slide), com:
- Cabeçalho: título do orçamento + badge de status + nome do paciente.
- Lista dos itens (`treatment_plan_items` + nome do procedimento via join) com dente (se houver), valor unitário, observação.
- Total, data de criação.
- Seletor de status (Pendente / Em Negociação / Aprovado / Perdido) — usa a mesma mutation já existente para atualizar `status` no `treatment_plans`.
- Botão "Excluir orçamento" (com `AlertDialog` de confirmação) que apaga `treatment_plan_items` + `treatment_plans` e invalida a query `treatment-plans-kanban`.
- Botão "Fechar".

Ajustar `BudgetCard.tsx`:
- Aceitar `onClick?: () => void`.
- Disparar `onClick` **apenas** quando o clique não vier do "punho" de arrastar (já há um botão dedicado `GripVertical` com `attributes/listeners`; remover `cursor-grab` do card inteiro e tornar o restante do card clicável com `cursor-pointer`).
- Manter `setNodeRef`/`transform` do `useSortable` no wrapper, mas `attributes`/`listeners` ficam exclusivamente no botão de arrastar para o clique não ser capturado pelo dnd.

Em `Budgets.tsx`:
- Estado `selectedPlanId: string | null`.
- Passar `onClick={() => setSelectedPlanId(plan.id)}` para cada `BudgetCard` (tanto na coluna quanto no `DragOverlay` pode ficar sem onClick).
- Renderizar `<BudgetDetailDialog planId={selectedPlanId} open={!!selectedPlanId} onOpenChange={(o)=>!o && setSelectedPlanId(null)} />`.

### 3. Pequenos polimentos
- Garantir `aria-describedby`/`DialogDescription` nos dialogs para silenciar o warning do Radix já visto no console.
- Manter as cores e o look já existentes (sem alterar paleta).

## Arquivos afetados
- `src/pages/Budgets.tsx` — novo `KanbanColumn` droppable, estado de seleção, render do detail dialog.
- `src/components/budgets/BudgetCard.tsx` — `onClick`, isolar listeners no handle.
- `src/components/budgets/BudgetDetailDialog.tsx` — **novo** componente (ver, mudar status, excluir).
- (opcional) `src/components/budgets/KanbanColumn.tsx` — se preferir extrair para fora.

Nenhuma mudança de schema/banco é necessária — `treatment_plans` e `treatment_plan_items` já têm as colunas e RLS necessárias.