## Contexto

Hoje o sistema **já tem** lançamentos financeiros por paciente (tabela `financial_transactions` com `patient_id`, `status` pendente/pago/atrasado/cancelado e a aba "Financeiro" dentro do prontuário). O que **falta** é:

1. Um resumo claro de "este paciente está em dia ou devendo".
2. Visibilidade desse status fora do prontuário (lista de pacientes).
3. Conexão automática entre orçamento aprovado e cobranças — respeitando a regra que você levantou: quem aprova depende de quem é o dono do paciente.

## Regra de quem gera as cobranças (importante)

- **Médico solo (clínica própria, sem secretária/admin além dele)** → ao mudar o orçamento para "Aprovado" no Kanban, o próprio sistema gera as cobranças automaticamente.
- **Médico vinculado a uma clínica de terceiros (existem outros admins/secretárias)** → o dentista só *envia* o orçamento ("em negociação"). Só a aprovação feita por um usuário com papel `admin` ou `secretary` da clínica dispara a criação das cobranças. Se o próprio dentista marcar como aprovado, nada é gerado (e mostramos um aviso "aguardando aprovação da clínica").

Detecção do modo solo: clínica em que o dentista é `owner` **e** `clinic_members` da mesma clínica tem só ele como `admin`/`secretary` (já existe `useSoloMode`).

## O que será entregue

### 1. Resumo financeiro no topo do prontuário (`PatientDetail.tsx`)
Card compacto acima das tabs, com:
- Total pago (verde)
- Em aberto (âmbar) — soma de `pending` com `due_date >= hoje`
- Atrasado (vermelho) — `pending`/`overdue` com `due_date < hoje`
- Badge grande: **"Em dia"** (sem nada em aberto) ou **"Devendo R$ X,XX"**
- Link "Ver detalhes" que rola até a aba Financeiro existente.

### 2. Badge na lista `/patients`
Próximo ao nome, um pequeno indicador:
- 🟢 Em dia
- 🟡 Em aberto
- 🔴 Atrasado

Calculado em um único query agregada por paciente (Map em memória), sem N+1.

### 3. Geração automática de cobranças a partir do orçamento
Em `BudgetDetailDialog`, quando o status muda para `approved`:
- Verifica se o usuário atual tem permissão (solo OU role admin/secretary da clínica).
- Se sim: cria N `financial_transactions` (`type=income`, `category=procedure`, `patient_id`, `clinic_id`, `dentist_id`, `amount`, `description` com nome do procedimento, `due_date` = hoje, `status=pending`). Marca o orçamento como `has_generated_charges` para nunca duplicar.
- Se não: bloqueia a aprovação no client e mostra toast "Apenas a secretaria/admin da clínica pode aprovar este orçamento".

### 4. Ação rápida "Marcar como pago" *(extra opcional, baixo custo)*
Botão em cada linha da aba Financeiro do prontuário que faz `update status=paid, paid_date=today` — facilita o dia-a-dia.

## Detalhes técnicos

**Migration necessária** (uma só):
- Adicionar coluna `treatment_plans.charges_generated_at timestamptz` (idempotência da geração).
- Nenhuma mudança em RLS — `financial_transactions` já tem policies corretas para clinic members.

**Arquivos a alterar:**
- `src/pages/PatientDetail.tsx` — adicionar `PatientFinancialSummary` no topo + botão "marcar como pago" na aba Financeiro.
- `src/components/patient/PatientFinancialSummary.tsx` *(novo)* — card de resumo.
- `src/pages/Patients.tsx` — query agregada + badge na lista.
- `src/components/budgets/BudgetDetailDialog.tsx` — hook na mudança para `approved` (checa permissão, gera transações, marca `charges_generated_at`).
- `src/hooks/usePatientFinancialStatus.ts` *(novo)* — hook reutilizável que retorna `{ paid, pending, overdue, status }`.

**Sem mudanças em:** edge functions, auth, tabelas além da coluna citada.

## Fora de escopo (intencional)

- Parcelamento configurável do orçamento (gera 1 cobrança por item; parcelar fica para Fase 2).
- Cobrança automática via Pix/boleto (continua sendo "registro manual" como definido no PRD).
- Notificação push ao paciente sobre pendência financeira.
