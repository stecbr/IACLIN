## Objetivo

Hoje, quando o dentista cria um orçamento ele já entra direto no pipeline (Pendente → Aprovado → Perdido). Em clínicas com equipe, isso ignora a hierarquia: o orçamento deveria precisar do aval do **dono / admin / secretária** antes de virar oficial. Vamos replicar o fluxo já usado em consultas (`/aprovacoes`) para orçamentos.

## Fluxo proposto

1. **Dentista ou medico vinculado a uma clínica** cria um orçamento → ele entra como **"Aguardando aprovação da clínica"** (não aparece no Kanban tradicional ainda).
2. **Admin / dono / secretária** vê o pedido na página **Aprovações** (nova aba "Orçamentos"), com:
  - paciente, dentista, itens, valor total, observações
  - botões **Aprovar** / **Recusar** (com motivo)
3. Ao **aprovar** → o orçamento entra na coluna **Pendente** do pipeline normal e fica visível para todos.
4. Ao **recusar** → fica marcado como recusado, com o motivo, e o dentista recebe notificação.
5. **Dentista solo** (sem clínica) ou **admin/secretária criando o orçamento** → entra direto como `pending` (sem etapa de aprovação), comportamento atual mantido.
6. O dentista vê seus orçamentos "aguardando aprovação" numa **faixa separada** no topo do Kanban (apenas leitura, com badge âmbar).
7. Badge de contagem em **Aprovações** na sidebar passa a somar consultas + orçamentos pendentes.

## Detalhes técnicos

### Banco

- Adicionar status `awaiting_clinic_approval` e `rejected_by_clinic` ao `treatment_plans_status_check`.
- Novas colunas em `treatment_plans`:
  - `approval_required_by_clinic boolean default false`
  - `approved_by uuid references auth.users(id)`
  - `approved_at timestamptz`
  - `rejection_reason text`
- Migration ajusta o trigger/check; políticas RLS atuais já permitem clínica ver, então basta filtrar por status no front.

### Backend (Edge Functions)

- `approve-budget` — valida que o usuário é admin/secretária/owner da clínica do paciente, muda status para `pending`, registra `approved_by/at`, cria notificação para o dentista.
- `reject-budget` — mesma validação, status `rejected_by_clinic`, salva `rejection_reason`, notifica dentista.

### Frontend

- `**BudgetFormDialog.tsx**`: detectar role + clínica do paciente. Se `role==='dentist'` e paciente tem `clinic_id`, inserir com `status='awaiting_clinic_approval'` e `approval_required_by_clinic=true`. Toast: "Orçamento enviado para aprovação da clínica".
- `**Budgets.tsx` (Kanban)**: filtrar fora os `awaiting_clinic_approval` e `rejected_by_clinic` das 3 colunas e mostrar uma **faixa informativa** acima quando o dentista logado tem itens aguardando.
- `**ClinicaAprovacoes.tsx**`: novas abas "Consultas" / "Orçamentos"; lista de orçamentos pendentes com card próprio (`BudgetApprovalCard`) chamando as edge functions acima. Realtime via canal `treatment_plans`.
- **Sidebar (`AppSidebar.tsx`)**: badge de Aprovações passa a contar `appointment_requests.pending + treatment_plans.awaiting_clinic_approval` da clínica.
- **Notificações**: aproveitar o sistema atual (`notifications` / `NotificationBell`) para avisar o dentista quando o orçamento é aprovado ou recusado.

### Permissões

- Reutiliza `useRoleAccess` + `useSoloMode`: aprovar/recusar exposto apenas para `admin`, `secretary` ou `owner` da clínica. Dentista vê em modo somente leitura.

## Fora do escopo

- Alterar a parte de orçamentos pessoais (sem clínica) — segue funcionando como hoje.
- Edição do orçamento pelo aprovador antes de aprovar (pode entrar numa iteração futura).