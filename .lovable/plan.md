## Problema atual

1. **Arrastar não funciona ao segurar o card** — só funciona segurando o ícone ⠿ (GripVertical), que é pequeno e nada intuitivo. O usuário tentou segurar o card inteiro e não respondeu.
2. **Visual do Kanban está "básico"** — colunas tracejadas, cards simples. O usuário quer algo no estilo **Pipefy** (referência da imagem): cards mais ricos, com cabeçalho, chips/badges, avatar, informações organizadas, e colunas mais "sólidas" e profissionais — mas adaptado ao contexto de **clínicas e médicos** (não estoque).

## O que vou fazer

### 1. Corrigir o arrastar (card inteiro vira "pegável")

- Remover o `button` com `GripVertical` como único drag handle no `BudgetCard`.
- Aplicar `{...attributes} {...listeners}` no **card inteiro** (Card raiz), com `cursor-grab` / `active:cursor-grabbing`.
- Manter o clique para abrir o `BudgetDetailDialog`: usar o `activationConstraint: { distance: 8 }` do `PointerSensor` (já existe com 5px — aumentar levemente) para diferenciar clique de drag, e disparar `onClick` no `onPointerUp` apenas se não houve drag. Solução mais limpa: deixar o dnd-kit cuidar — se passar de 8px é drag, senão o `onClick` do Card dispara normalmente (dnd-kit não cancela cliques curtos por padrão).
- Manter o ícone ⠿ como **indicador visual** no canto (não mais como handle exclusivo), apenas decorativo.

### 2. Redesign Pipefy-style do Kanban (contexto clínica/médico)

**Colunas (`KanbanColumn`)**
- Remover borda tracejada. Usar fundo sólido sutil (`bg-muted/40`), cabeçalho com **barra colorida superior** (4px) indicando a fase (âmbar/azul/esmeralda/rosa).
- Cabeçalho da coluna: título em negrito, contagem em pill, total em R$ alinhado à direita.
- Coluna com `rounded-xl`, `shadow-sm`, padding interno consistente, scroll vertical se passar de N cards.
- Placeholder de coluna vazia mais elegante ("Solte um orçamento aqui").

**Cards (`BudgetCard`) — estilo Pipefy adaptado a clínica**
- Card branco/superfície com `rounded-lg`, `shadow-sm`, `hover:shadow-md`, borda esquerda colorida (4px) na cor da fase — referência visual rápida do status.
- **Linha 1 (cabeçalho):** ID curto do orçamento (`#abc123`) em mono pequeno + data à direita.
- **Linha 2 (título):** título do orçamento em `font-medium`, 2 linhas com `line-clamp-2`.
- **Linha 3 (paciente):** avatar circular com iniciais + nome do paciente + (se houver) nome do **médico/dentista responsável** com avatar menor — esse é o "voltando para médicos e clínicas".
- **Linha 4 (chips):** badge com nº de procedimentos (`ClipboardList` icon + "3 itens"), badge da **especialidade/clínica** se disponível, badge de convênio se houver.
- **Linha 5 (rodapé):** valor total em destaque (`text-base font-semibold`) à esquerda, mini-indicador de fase à direita.

### 3. Buscar dados extras já disponíveis

Verificar no `treatment_plans` se existe `dentist_id` (já existe — usado no filtro) e fazer join com `profiles` para mostrar o médico responsável. Mostrar nome da clínica não é necessário no card (já está no contexto da página via `contextLabel`).

## Arquivos afetados

- `src/components/budgets/BudgetCard.tsx` — drag no card todo, redesign Pipefy-style com avatar do médico e chips.
- `src/pages/Budgets.tsx` — `KanbanColumn` redesenhado (barra colorida, sem tracejado), query incluindo `dentist:profiles!treatment_plans_dentist_id_fkey(full_name, avatar_url)`, `activationConstraint` ajustado.
- Sem mudanças de schema, sem mudanças no `BudgetDetailDialog`.

## Detalhes técnicos

- `useSortable` aplicado ao Card raiz; ícone ⠿ removido como botão, mantido apenas como ornamento opcional (ou removido por completo já que o card todo arrasta).
- `onClick` do Card abre detalhes; `PointerSensor` com `distance: 8` garante que cliques curtos não disparem drag.
- Cores das fases derivadas de um único mapa `PHASE_STYLE` (border-left + barra superior da coluna + chip do badge) para consistência.
- Avatar do médico: componente `Avatar` shadcn com fallback de iniciais, tamanho `h-5 w-5`.
