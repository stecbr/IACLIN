## Vinculação inteligente de pacientes (CPF)

Implementar fluxo de detecção de CPF no cadastro de pacientes (Agenda, Orçamentos e Pacientes) com solicitação de vínculo via consentimento do paciente, e convite por e-mail para CPFs não cadastrados.

### 1. Banco de dados (migration)

**Nova tabela `patient_link_requests`**
- `id`, `requested_by_user_id`, `clinic_id`, `patient_user_id` (FK auth.users — paciente já existente), `cpf`, `status` (`pending|accepted|rejected|expired|cancelled`), `expires_at` (24h), `responded_at`, `created_at`, `updated_at`.
- RLS: paciente pode `SELECT/UPDATE` seus próprios pedidos; solicitante (clínica/médico) pode `SELECT/INSERT/UPDATE` os que criou.
- GRANTS para `authenticated` + `service_role`.
- Índices em `cpf`, `patient_user_id`, `status`.

**Nova tabela `patient_invites`** (Fluxo 2 — CPF sem conta)
- `id`, `token` (uuid único), `requested_by_user_id`, `clinic_id`, `full_name`, `cpf`, `phone`, `email`, `status` (`pending|accepted|expired|cancelled`), `expires_at` (7 dias), `accepted_user_id`, `created_at`.
- RLS: solicitante vê os seus; leitura pública via edge function por token.

**Trigger:** quando `patient_link_requests.status = 'accepted'`, criar registro em `public.patients` (vinculado à clínica) copiando dados de `patient_accounts` + setar `patient_user_id`. Idempotente (se já existir patient com mesmo CPF + clinic_id, apenas atualiza `patient_user_id`).

**Trigger no signup (`handle_new_user`):** ao criar `patient_account`, buscar `patient_invites` pendentes com o mesmo CPF/email → marcar `accepted`, criar `patients` na clínica do convite e vincular.

### 2. Edge functions

- **`request-patient-link`**: recebe `{ cpf, clinic_id }`. Verifica se existe `patient_accounts` com CPF. Se sim, cria `patient_link_requests` (24h), gera notificação in-app + dispara e-mail. Retorna `{ exists: true, request_id }`. Se não, retorna `{ exists: false }`.
- **`respond-patient-link`**: paciente autenticado aceita/recusa. Em "accepted" cria `patients` na clínica.
- **`invite-new-patient`**: cria `patient_invites` + envia e-mail com link `/cadastro?invite=<token>`.
- **`accept-patient-invite`**: chamada após signup do paciente, valida token e vincula.

Todas com `verify_jwt = true` exceto `accept-patient-invite` (pode ser pública via token).

**E-mail:** usar Lovable Emails (transactional). Templates simples com botão "Visualizar Solicitação" → `/notifications` e "Criar Minha Conta" → `/auth?invite=<token>`.

### 3. Frontend

**`PatientFormDialog.tsx`** — quando usuário digita CPF válido:
- Debounce → chama `request-patient-link` em modo "check" (ou nova função `check-patient-cpf` apenas leitura).
- Se existe conta: substitui botão "Salvar" por **"Solicitar Vinculação ao Paciente"**. Mostra aviso "Este CPF já possui conta na iClin. O paciente precisa aprovar a vinculação." Bloqueia edição de outros campos.
- Se não existe: mantém fluxo atual de cadastro. Após salvar, se `email` informado, mostra opção "Enviar convite para o paciente criar conta" (chama `invite-new-patient`).

Adicionar também botão **"Solicitar Vinculação"** quando combobox de paciente em Agenda/Orçamentos não encontrar resultados e o usuário digitar um CPF.

**Página do paciente — Notificações**
- Em `PatientHome` / `PatientSidebar`: badge para `patient_link_requests` pendentes.
- Nova seção/dialog `LinkRequestsPanel.tsx` listando solicitações com botões **Aceitar / Recusar**, mostrando clínica/profissional solicitante e prazo.
- Quando paciente entra com `?invite=<token>` no `/auth`, fluxo de cadastro pré-preenche dados e marca convite como aceito após signup.

**Notificação in-app**: aproveitar tabela `notifications` existente (tipo `patient_link_request`).

### 4. Segurança
- RLS em `patients` continua exigindo membership de clínica. Vinculação só é criada após `accepted` (via trigger SECURITY DEFINER).
- Nenhum endpoint expõe dados do paciente antes do consentimento — `request-patient-link` retorna apenas `{ exists: boolean }`, sem nome/telefone.
- Expiração automática: solicitação pendente > 24h vira `expired` (filtro nas queries; opcional job cron).

### Arquivos

**Novos**
- `supabase/migrations/<timestamp>_patient_linking.sql`
- `supabase/functions/request-patient-link/index.ts`
- `supabase/functions/respond-patient-link/index.ts`
- `supabase/functions/invite-new-patient/index.ts`
- `supabase/functions/accept-patient-invite/index.ts`
- `src/components/patient/LinkRequestsPanel.tsx`
- `src/components/patients/RequestLinkButton.tsx`

**Editados**
- `src/components/patients/PatientFormDialog.tsx` (detecção CPF + UI condicional + envio de convite)
- `src/components/agenda/AppointmentFormDialog.tsx` e `src/components/budgets/BudgetFormDialog.tsx` (atalho de solicitação quando CPF buscado não está na clínica)
- `src/pages/Auth.tsx` (suporte ao parâmetro `?invite=<token>`)
- `src/pages/patient/PatientHome.tsx` (mostrar pedidos pendentes)
- `src/components/NotificationBell.tsx` (novo tipo)

### Fora do escopo
- Permissões granulares por dado (todos os dados visíveis após aceite, conforme PRD).
- Expiração via cron — usar filtro `expires_at > now()` nas leituras.
