## Visão geral

Adicionar a **operadora** como uma 3ª camada do ecossistema (Paciente · Clínica/Médico · Operadora), sem que ela seja dona de ninguém. Escopo deliberadamente o "MVP REAL" que você descreveu — sem TISS, autorização de guias, faturamento ANS ou repasse.

```text
PACIENTE → MARKETPLACE → CLÍNICA → MÉDICO → AGENDA
                                ↑
                          OPERADORA (credencia)
```

## O que já existe e será reaproveitado

- Tabela `insurance_plans` (hoje convênios cadastrados pela clínica em Configurações).
- Tabelas `patient_accounts.insurance_provider` e `patients.insurance_provider/insurance_number`.
- `src/lib/insuranceBrand.ts` (cores oficiais Unimed/Hapvida/Amil/etc.).
- Filtro de convênio no marketplace (`BookingFilters.tsx`).
- Sistema multi-tenant + RBAC (`app_role`, `clinic_members`, `has_role`).

## Escopo do MVP (o que será construído)

### 1. Modelo de dados (migration)
- **`insurance_operators`** (operadora master, global): `id`, `name`, `slug`, `ans_code`, `type` (`medico` | `odonto` | `ambos`), `brand_color`, `logo_url`, `is_active`.
- **`operator_members`**: vincula `user_id` ↔ `operator_id` com `role` (`admin` | `analyst`). Análogo a `clinic_members`.
- **`operator_credentialings`** (pedido de vínculo): `operator_id`, `clinic_id`, `professional_id` (clinic_member), `status` (`pending` | `approved` | `rejected` | `revoked`), `requested_by`, `requested_at`, `decided_at`, `rejection_reason`.
- **`clinic_member_insurance_plans`**: tabela de junção `clinic_member_id` ↔ `insurance_plan_id` para o médico declarar quais planos aceita (hoje só existe no nível da clínica).
- **`availability_slots`**: adicionar coluna opcional `insurance_plan_id` para reservar bloco de horário a um convênio específico (a coluna fica nula = horário livre/particular).
- **Novo `app_role`**: `'operator'`.
- **Helper SQL**: `user_belongs_to_operator(uuid, uuid)` (análogo a `user_belongs_to_clinic`).
- **RLS**:
  - Operadora vê apenas `clinic_members` e horários de profissionais com credenciamento `approved` na sua operadora.
  - Operadora **NUNCA** vê `clinical_records`, `exams`, `prescriptions`, `treatment_plans`, `attendances`, `consultation_recordings` (LGPD).
  - Pode ler `appointments` apenas com colunas restritas (sem notas clínicas) — via VIEW `operator_appointments_view`.

### 2. Autenticação e onboarding da operadora
- Novo fluxo de cadastro em `/auth` (aba "Sou Operadora"): nome legal, CNPJ, código ANS, tipo (médico/odonto/ambos), responsável.
- `handle_new_user` ganha branch `v_user_type = 'operadora'` que cria registro em `insurance_operators` + `operator_members` (owner) + role `operator`.
- Após login, redireciona para `/operadora` (workspace próprio).

### 3. Workspace da operadora (`/operadora/*`)
Layout próprio (`OperatorLayout.tsx`) com sidebar isolada — operadora não enxerga sidebar clínica.

- **`/operadora`** — Dashboard: nº de profissionais credenciados, pedidos pendentes, distribuição por especialidade/cidade.
- **`/operadora/rede`** — Lista de profissionais credenciados (busca, filtros por especialidade, cidade, clínica). Tabela com nome, CRM/CRO, especialidades, clínica, status.
- **`/operadora/pedidos`** — Inbox de pedidos de credenciamento (aprovar/recusar com motivo).
- **`/operadora/agenda`** — Visualização read-only da disponibilidade liberada para o plano (sem prontuário).
- **`/operadora/configuracoes`** — Logo, cores (já temos brand do `insuranceBrand.ts`), dados cadastrais.

### 4. Lado clínica/profissional
- **Settings → "Convênios aceitos"** (por profissional): médico marca quais operadoras atende. Cada marca gera um `operator_credentialings` com status `pending` automaticamente.
- **Sino de notificações**: notifica clínica quando operadora aprova/recusa.
- **Editor de disponibilidade** (`WeeklyTemplateTab`): adicionar opção "Reservar este bloco para convênio X" (popula `availability_slots.insurance_plan_id`).
- **Página `/clinica/credenciamentos`**: ver status dos pedidos enviados.

### 5. Marketplace (paciente)
- Filtro "Convênio" já existe → passa a cruzar com `operator_credentialings.status = 'approved'` ao invés de só `insurance_plans` do clinic.
- Card do médico mostra badge colorida das operadoras credenciadas (usa `insuranceBrand.ts`).
- Ao agendar com convênio selecionado: só lista horários cujo `availability_slots.insurance_plan_id` seja nulo (livre) ou match.

### 6. Edge functions
- `request-credentialing` — clínica/médico solicita vínculo (validações + notificação).
- `decide-credentialing` — operadora aprova/recusa (validações + notificação + audit log).

## O que NÃO entra neste MVP (deferido)

- Integração TISS / XML ANS.
- Autorização de guias.
- Faturamento / repasse / glosa.
- API mock de operadora externa.
- Auditoria médica / segunda opinião.
- Encaminhamento ativo (operadora "manda" pacientes).

Esses ficam em `mem://roadmap/deferred-features` para Fase 2.

## Detalhes técnicos

```text
auth.users
   ├── user_roles (operator)
   └── operator_members ──► insurance_operators
                                 │
                                 ├── operator_credentialings ──► clinic_members
                                 │                          └──► clinics
                                 └── (futuro) operator_referrals

clinic_members ──► clinic_member_insurance_plans ──► insurance_plans
availability_slots.insurance_plan_id (FK opcional)
```

**RLS chave (operator_credentialings):**
- `SELECT`: operador da operadora OU membro da clínica envolvida.
- `INSERT`: membro da clínica (`status='pending'` forçado).
- `UPDATE`: apenas operador, e somente `status`/`decided_at`/`rejection_reason`.

**View `operator_visible_professionals`** (security definer): retorna nome, especialidades, clínica, cidade — sem CPF/telefone pessoal.

## Entregáveis

1. 1 migration SQL (tabelas + RLS + helpers + `app_role` + view).
2. Atualização do `handle_new_user`.
3. 2 edge functions (`request-credentialing`, `decide-credentialing`).
4. ~8 páginas/componentes novos sob `src/pages/operadora/` + `OperatorLayout`.
5. Ajustes em: `Auth.tsx`, `SettingsPage.tsx`, `WeeklyTemplateTab.tsx`, `BookingFilters.tsx`, `ClinicDoctorStep.tsx`, sidebar.
6. Atualização de memory (`mem://features/operators` + index).

Quer que eu implemente tudo nessa ordem ou prefere fatiar (ex.: começar só pela camada de dados + cadastro da operadora e deixar marketplace/agenda para um segundo passo)?