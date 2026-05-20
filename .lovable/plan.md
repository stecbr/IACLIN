## Objetivo

1. Adicionar botão "Abrir prontuário" dentro do modal de detalhes do orçamento (`BudgetDetailDialog`), além do que já existe no card.
2. Quando o usuário abrir o prontuário a partir do orçamento, mostrar um botão "Voltar ao orçamento" no `PatientDetail`, que retorna para `/budgets` com o modal do mesmo orçamento já aberto.

## Mudanças

### 1. `src/components/budgets/BudgetDetailDialog.tsx`
- Importar `useNavigate` do `react-router-dom` e ícone `FileText` (ou `Stethoscope`).
- Garantir que a query retorna `patients(id, full_name)` (hoje só traz `full_name`).
- Adicionar botão **"Abrir prontuário"** no `DialogFooter` (ao lado do "Fechar"), desabilitado se não houver `patient_id`.
- Ao clicar: `navigate('/patients/' + patientId, { state: { fromBudgetId: planId } })` e fechar o modal.

### 2. `src/pages/Budgets.tsx`
- Ao montar a página, ler `location.state?.openBudgetId` (via `useLocation`) e, se presente, setar `selectedPlanId` para reabrir o modal automaticamente.
- Limpar o state após consumir (`navigate('.', { replace: true, state: {} })`) para não reabrir em navegações futuras.
- No card (`onOpenChart`) também propagar o `state: { fromBudgetId: plan.id }` ao navegar para `/patients/:id`, mantendo consistência.

### 3. `src/pages/PatientDetail.tsx`
- Usar `useLocation` para ler `state.fromBudgetId`.
- Quando presente, renderizar no topo um botão discreto **"← Voltar ao orçamento"** que executa `navigate('/budgets', { state: { openBudgetId: fromBudgetId } })`.
- Estilo coerente com o header do prontuário (botão `variant="ghost"` com ícone `ArrowLeft`).

## Arquivos afetados
- `src/components/budgets/BudgetDetailDialog.tsx`
- `src/pages/Budgets.tsx`
- `src/pages/PatientDetail.tsx`

Sem mudanças de banco. Sem mudanças no `BudgetCard` (já tem o botão de prontuário).
