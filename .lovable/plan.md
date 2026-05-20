## Problema identificado

O erro `treatment_plans_status_check` ocorre porque o banco só aceita os status `pending`, `approved`, `in_progress`, `completed`, `cancelled` — mas o Kanban usa `pending`, `negotiating`, `approved`, `lost`. Por isso só "Aprovado" funciona; arrastar para **Em Negociação** ou **Perdido** é bloqueado pelo banco.

## Plano

### 1. Corrigir o check constraint (migration)
- Substituir `treatment_plans_status_check` para aceitar: `pending`, `negotiating`, `approved`, `lost` (mantendo retrocompatibilidade com linhas antigas via normalização: `in_progress` → `negotiating`, `completed` → `approved`, `cancelled` → `lost`).
- UPDATE para migrar quaisquer registros legados antes do novo CHECK.

### 2. Enriquecer o BudgetCard
Adicionar diretamente no card (visível sem abrir o modal):
- **Médico que indicou** (dentist_name — já temos) com ícone de estetoscópio.
- **Lista resumida de procedimentos/exames** (primeiros 2 nomes + "+N" se houver mais), buscados via join `treatment_plan_items → procedures(name)`.
- **Botão "Prontuário"** no rodapé do card que navega para `/patients/:patient_id` (precisa de `patient_id` no payload — já temos via `patients` join, basta expor o id).
- Manter drag pelo corpo do card; o botão de prontuário usa `stopPropagation` para não disparar o modal nem o drag.

### 3. Ajustes em Budgets.tsx
- Incluir `patients!inner(id, full_name, clinic_id)` e `treatment_plan_items(id, procedures(name))` no select.
- Passar `patientId` e `procedureNames[]` para `BudgetCard`.
- Usar `useNavigate` do react-router para o botão de prontuário.

### Arquivos afetados
- Nova migration SQL (status check)
- `src/components/budgets/BudgetCard.tsx`
- `src/pages/Budgets.tsx`

Sem alterações no `BudgetDetailDialog` (os status já estavam corretos lá — o erro vinha apenas do CHECK do banco).