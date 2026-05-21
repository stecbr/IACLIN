## Vincular paciente em transações financeiras

### 1. Diálogo "Nova Transação" (Financeiro global)

No `NewTransactionDialog` em `src/pages/Financial.tsx`:

- Adicionar campo opcional **Paciente** (combobox com busca) que carrega `patients` do `currentClinicId` (ou do dentista, em modo solo).
- Mostrar somente quando `type = 'income'` (faz sentido vincular paciente em receita).
- Persistir `patient_id` no insert em `financial_transactions`.
- Se a clínica não é solo e o usuário é `dentist` (sem permissão financeira da clínica), bloquear receitas vinculadas a paciente da clínica com toast: *"Apenas a secretaria/admin da clínica pode lançar cobranças. Solicite à equipe."* — usando a mesma regra de `useSoloMode` + `useRoleAccess` já adotada em `BudgetDetailDialog`.

### 2. Lançar transação direto do prontuário

Na aba **Financeiro** de `src/pages/PatientDetail.tsx`:

- Adicionar botão **"Nova cobrança"** no topo da lista (e no estado vazio).
- Abrir um novo diálogo `PatientTransactionDialog` (reutiliza grande parte do form atual), com paciente já fixado (`patient_id = id`) e contexto `clinic_id` do paciente.
- Mesma regra de aprovação: dentista comum em clínica multi-membro não pode criar — mostra mensagem orientando pedir à secretaria. Solo / admin / secretaria podem.
- Após salvar, invalidar `patient-transactions`, `patient-financial-status`, `patients-financial-status-bulk` e `financial-transactions`.

### 3. Exibição

- Mostrar nome do paciente como badge/linha secundária nos cards de transação em `Financial.tsx` (consulta já pode trazer `patients(full_name)`).
- No prontuário, manter a lista atual (já filtra por paciente).

### Detalhes técnicos

- Sem mudanças de schema: `financial_transactions.patient_id` e `clinic_id` já existem; RLS atual já cobre.
- Componente compartilhado sugerido: extrair `TransactionFormFields` para reuso entre `NewTransactionDialog` (Financeiro) e `PatientTransactionDialog` (prontuário), evitando duplicação.
- Hook novo `useClinicPatients(clinicId)` simples para o combobox (cacheável via React Query).
- Regra de permissão centralizada num helper `canManageClinicFinance({ isSolo, role })` retornando boolean — usar nos dois diálogos e em `BudgetDetailDialog` (refator opcional).  
  
Fluxo de aprovação assíncrona (dentista /*medico cria como "aguardando aprovação" e secretaria libera). Hoje é bloqueio simples. - Adiciona isso tambem por favor

### Fora de escopo

- Parcelamento da cobrança.
- Fluxo de aprovação assíncrona (dentista /*medico cria como "aguardando aprovação" e secretaria libera). Hoje é bloqueio simples. - Adiciona isso tambem por favor