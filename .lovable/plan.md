## Mudanças no Kanban de Orçamentos

### Novo pipeline (4 colunas)
1. **Pendente** (âmbar) — orçamentos criados/aguardando ação
2. **Aprovado** (azul) — cliente aceitou, aguardando execução/pagamento pela secretaria/admin
3. **Realizado** (verde) — procedimento executado e pagamento cobrado/registrado
4. **Não aprovado** (rosa) — substitui "Perdido"

### Alterações técnicas

**Banco** (`treatment_plans.status` check constraint)
- Adicionar `'realized'` como status válido
- Manter `'pending'`, `'approved'`, `'awaiting_clinic_approval'`, `'rejected_by_clinic'`
- Renomear semanticamente `'lost'` → `'not_approved'` (migração: `UPDATE treatment_plans SET status='not_approved' WHERE status='lost'` + atualizar check constraint)

**Frontend**
- `src/pages/Budgets.tsx`: atualizar array `COLUMNS` para as 4 novas colunas com labels e cores; grid passa de `lg:grid-cols-3` (atual implícito) para `lg:grid-cols-4`
- `src/components/budgets/BudgetCard.tsx` e `BudgetDetailDialog.tsx`: atualizar mapeamento de label/cor de status (`lost` → `not_approved` rotulado "Não aprovado"; adicionar `realized` rotulado "Realizado")
- Qualquer outro lugar que referencie `status === 'lost'` (busca rápida em `src/`)

### Comportamento de drag-and-drop
Mantido — usuário pode arrastar entre as 4 colunas livremente. A coluna "Realizado" é o destino final após o pagamento ser registrado (fluxo manual por enquanto; integração automática com financeiro fica fora do escopo desta mudança).

### Fora do escopo
- Disparar criação automática de transação financeira ao mover para "Realizado" (pode ser próxima iteração)
- Mudanças no fluxo de aprovação da clínica (já implementado)
