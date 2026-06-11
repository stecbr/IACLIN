# Procedimentos por profissional + Aprovação configurável

## Objetivo
Permitir que cada profissional declare exatamente quais procedimentos do catálogo realiza dentro de cada clínica, e que a clínica escolha quem aprova os agendamentos feitos pela IA. A Secretária IA passa a saber, para cada procedimento solicitado, quais profissionais estão aptos e quando têm horário.

## Hoje (estado atual)
- `procedures`: catálogo global por `specialty_category`. Sem vínculo com profissional.
- `clinic_member_specialties` / `professional_specialties`: só especialidades, granularidade grossa.
- `professional_schedule_template` + `professional_availability`: agenda por profissional já existe.
- IA recebe via `aiBackend.syncDoctors` apenas `specialty` (string única) e via `syncConfig` o catálogo da clínica inteira — sem mapa procedimento→profissional.
- `appointment_requests` é sempre aprovado por admin/secretária da clínica.

## O que vamos construir

### 1. Banco: tabela de procedimentos por membro da clínica
Nova tabela `clinic_member_procedures` (lista exata por profissional, escopo da clínica):
- `clinic_member_id` (FK → clinic_members, cascade)
- `procedure_id` (FK → procedures)
- `custom_duration` (nullable, override do default do catálogo)
- `custom_price` (nullable, override)
- UNIQUE (clinic_member_id, procedure_id)
- RLS: leitura por membros da clínica + anon (marketplace); escrita pelo próprio profissional, owner ou admin da clínica.
- GRANTs: `authenticated` (CRUD), `anon` (SELECT), `service_role` (ALL).

### 2. Banco: flag de aprovação por clínica
Adicionar em `clinics`:
- `appointment_approval_mode` text default `'clinic'` (`'clinic'` | `'professional'`).

Ajustar `notify_appointment_request_change`: quando o modo for `'professional'`, notificar apenas o `dentist_id` em vez de admins/secretárias; quando for `'clinic'`, manter o comportamento atual. As Edge Functions `approve-appointment-request` / `reject-appointment-request` passam a aceitar a aprovação do próprio `dentist_id` quando a clínica estiver em modo `'professional'`.

### 3. UI — Profissional
- **Perfil do profissional (Profile.tsx)** e **Configurações → Equipe** (`EditDoctorSpecialtiesDialog`):
  - Nova aba/seção "Procedimentos que realizo" com lista do catálogo filtrada pela categoria da clínica.
  - Multiselect com busca, agrupado por categoria do procedimento.
  - Opção de definir duração/preço personalizados por procedimento (opcional).
- Aviso na agenda quando o profissional não tem nenhum procedimento marcado ("Cadastre seus procedimentos para que a IA e a clínica possam direcionar pacientes corretamente").

### 4. UI — Clínica
- **Configurações → Clínica**: novo toggle "Quem aprova agendamentos solicitados via IA/online?" com opções `Clínica (admin/secretária)` ou `Profissional`.
- **Equipe (TeamSection)**: na linha de cada membro, badge com a quantidade de procedimentos cadastrados; admin/owner pode editar pela mesma tela.
- **Marketplace público (`DoctorCard`, perfil público)**: passar a listar os procedimentos do profissional (não só especialidade) e usar isso no filtro de busca "tratamento de canal" → só mostra quem tem o procedimento marcado.

### 5. Sync para a Secretária IA
- Estender `SyncDoctor` (em `src/lib/aiBackend.ts`) com `procedures: { id, name, duration_min, price }[]`.
- `useAiSync` passa a buscar `clinic_member_procedures` joined com `procedures` e enviar no `syncDoctors`/`syncDoctor`.
- Estender `SyncConfigPayload` para incluir `approval_mode` da clínica, para a IA saber se deve avisar "aguardando aprovação da clínica" ou "aguardando aprovação do(a) Dr(a). X".
- Sem mudança no fluxo de criação: a IA continua criando em `ai_appointment_requests`, só muda quem é notificado/quem aprova.

### 6. Fluxo de agendamento pela IA (resultado prático)
1. Paciente diz: "quero tratamento de canal".
2. IA filtra `clinic_member_procedures` por `procedure.name ILIKE 'canal'` → lista de profissionais aptos da clínica.
3. IA cruza com `professional_schedule_template` + `professional_availability` − `appointments` para mostrar horários reais.
4. Paciente escolhe; IA cria `ai_appointment_request`.
5. Notificação vai para clínica OU profissional conforme `appointment_approval_mode`.
6. Aprovação cria `appointments` (já aparece nas duas agendas — clínica e profissional, via `dentist_id`+`clinic_id`).

## Fora do escopo
- Comissão diferenciada por procedimento por profissional (fica para Financeiro v2).
- Aprovação granular por tipo de procedimento (só global por clínica nesta entrega).
- Bulk import de procedimentos por profissional via CSV.

## Ordem de implementação
1. Migration: `clinic_member_procedures` + `appointment_approval_mode` + ajuste do trigger de notificação.
2. UI do profissional para marcar procedimentos.
3. UI da clínica (toggle + visualização de procedimentos por membro).
4. Sync IA (`aiBackend.ts` + `useAiSync`).
5. Filtro do marketplace por procedimento exato.
6. Ajuste nas Edge Functions de approve/reject para permitir o profissional aprovar quando o modo for `professional`.
