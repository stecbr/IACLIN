## Contexto

Mudanças aplicam-se **apenas** ao fluxo onde o usuário se cadastra diretamente como Clínica (`user_type = 'clinica'` em `raw_user_meta_data`). O fluxo Médico/Dentista → cria clínica depois permanece intacto.

Detector usado em todo o frontend: `user.user_metadata.user_type === 'clinica'` (já existe em `Auth.tsx`).

---

## 1. Procedimentos compartilhados entre clínicas (bug crítico)

A tabela `procedures` hoje **não tem coluna `clinic_id`**. Por isso ao criar uma nova clínica todos os procedimentos antigos aparecem.

**Migration:**
- Adicionar `clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE` em `procedures`.
- Backfill: associar cada `procedures` existente à clínica do `owner_id` mais antigo do criador (estratégia: atribuir todos os procedimentos atuais à clínica do dono mais antigo que tenha pelo menos uma; alternativa simples acordada — atribuir à primeira clínica criada de cada categoria). Procedimentos sem dono claro ficam `NULL` e serão tratados como "globais legacy" e ocultados da nova UI.
- Tornar `clinic_id NOT NULL` após backfill.
- Substituir as policies atuais por policies por `clinic_id` usando `user_belongs_to_clinic(auth.uid(), clinic_id)`.
- Manter `GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated` + `GRANT ALL ... TO service_role`.

**Código (filtrar/incluir clinic_id em todas as queries):**
- `ProceduresCrudSection.tsx`: `select(...).eq('clinic_id', currentClinicId)`; no insert incluir `clinic_id: currentClinicId`.
- `Attendance.tsx`, `AppointmentFormDialog.tsx`, `BudgetFormDialog.tsx`, `MemberProceduresEditor.tsx`, `MyCredentialingSection.tsx`, `useAiSync.ts`, `SettingsPage.tsx` (bloco de sync IA): adicionar `.eq('clinic_id', currentClinicId)`.

---

## 2. Ocultar aba "Feriados" para usuários do tipo Clínica

`HolidaysSection.tsx` existe mas não está mais listada em `SettingsPage`. Confirmar que nenhuma aba "Feriados" é renderizada para `isClinicaSignup`. Caso esteja referenciada via rota/menu lateral em outro lugar, ocultar com `if (isClinicaSignup) return null`.

---

## 3. Mover "Especialidades" para fora do `/perfil` quando for Clínica

`Profile.tsx`: remover do array `sections` o item `specialty` quando `user_type === 'clinica'`.

A seção `SpecialtySection` já existe em `SettingsPage`. Mantida lá.

---

## 4. Ocultar "Meu Perfil" no menu lateral para Clínicas

`AppSidebar.tsx`: no rodapé/menu inferior, esconder o link "Meu Perfil" (`/perfil`) quando `user.user_metadata.user_type === 'clinica'`.

`useRoleAccess.ts`: bloquear acesso direto a `/perfil` para esse caso (redireciona para `/settings`).

---

## 5. Reorganização do `/settings` para usuários Clínica

Estrutura final do menu lateral interno de `SettingsPage` quando `isClinicaSignup`:

```
Clínica            (já existe)
Perfil do Proprietário   NOVO
Especialidades     (já existe — SpecialtySection)
Equipe             (já existe)
Salas              (já existe)
Convênios          (já existe)
Procedimentos      (já existe — agora por clínica)
Recebimentos       (já existe)
Segurança          NOVO (mover de Profile.tsx → reaproveitar SecuritySection)
Aparência          NOVO (mover de Profile.tsx → reaproveitar AppearanceBlock + ThemeCustomizer)
Assinatura         (já existe)
```

Para usuários Médico/Dentista que criam clínica depois, manter o array `sections` atual (nada muda).

---

## 6. "Perfil do Proprietário" (nova seção em Configurações)

Novo componente `src/components/settings/OwnerProfileSection.tsx` (apenas para Clínica). Edita `public.profiles` do `owner_id`:

- Avatar (upload em `clinic-assets/profiles/<owner_id>/...`) → grava `profiles.avatar_url`
- Nome completo (`full_name`)
- Telefone (`phone`)
- CRM / CRO (campo `registration_number` em `clinic_members` do owner naquela clínica)
- Especialidades (reaproveitar lógica de `professional_specialties` + `clinic_member_specialties`)
- Biografia (`profiles.bio` — adicionar coluna se não existir)

A foto salva em `profiles.avatar_url` já é consumida pelo sidebar (`profile?.avatar_url`), Marketplace (`get_marketplace_doctor_profiles`) e Redes Médicas. Nada extra precisa ser feito além de garantir refresh do `AuthContext`.

---

## 7. Modal de primeiro acesso + gate de publicação

**Migration:**
- Adicionar em `public.clinics`:
  - `is_published BOOLEAN NOT NULL DEFAULT false`
  - `onboarding_completed_at TIMESTAMPTZ`
  - `welcome_dismissed_at TIMESTAMPTZ`

**Componente `FirstAccessClinicDialog.tsx`:**
- Disparado em `AppLayout` quando: `user_type === 'clinica'` AND `currentClinic.welcome_dismissed_at IS NULL` AND `onboarding_completed_at IS NULL`.
- Texto conforme spec do usuário.
- Botões:
  - "Ir para Configurações" → `navigate('/settings')` + grava `welcome_dismissed_at = now()`
  - "Fazer Depois" → fecha + grava `welcome_dismissed_at = now()`
- Pode fechar (X).

**Aviso visual de pendência:**
Banner no topo de `/` (Dashboard) e `/settings` quando `is_published = false`, indicando campos obrigatórios faltantes (Nome, CNPJ/CPF, Telefone, Endereço completo, ao menos 1 especialidade, ao menos 1 procedimento, foto do proprietário).

**Publicação:**
Botão "Salvar" da seção "Clínica" em `/settings` valida campos obrigatórios:
- Se completos: seta `is_published = true` e `onboarding_completed_at = now()`.
- Caso contrário: mantém `is_published = false` e exibe lista de pendências.

**Gate em Marketplace / Redes / Agendamento:**
- `Marketplace.tsx`: filtrar `clinics.is_published = true` no fetch.
- `get_marketplace_doctor_profiles`: filtrar apenas profissionais cuja clínica esteja publicada.
- `PatientBooking.tsx`: bloquear agendamento em clínicas não publicadas.

Para clínicas pré-existentes (médicos que já criaram), backfill `is_published = true` na migration para não quebrar nada.

---

## Arquivos novos
- `src/components/settings/OwnerProfileSection.tsx`
- `src/components/settings/SecuritySettingsSection.tsx` (extrai de `Profile.tsx`)
- `src/components/settings/AppearanceSettingsSection.tsx` (extrai de `Profile.tsx`)
- `src/components/FirstAccessClinicDialog.tsx`
- `src/components/PublishPendingBanner.tsx`
- `src/hooks/useIsClinicSignup.ts` (helper único: `user.user_metadata.user_type === 'clinica'`)

## Arquivos editados
- Migration: `procedures.clinic_id` + RLS, `clinics.is_published / onboarding_completed_at / welcome_dismissed_at`, opcional `profiles.bio`.
- `src/pages/SettingsPage.tsx` — sections condicionais por tipo de usuário.
- `src/pages/Profile.tsx` — remover Especialidades quando Clínica; (componentes Security/Appearance ficam como compat — Profile some do menu nesse caso).
- `src/components/AppSidebar.tsx` — esconder "Meu Perfil" para Clínica.
- `src/hooks/useRoleAccess.ts` — bloqueio de `/perfil` para Clínica.
- `src/components/AppLayout.tsx` — montar `FirstAccessClinicDialog` + `PublishPendingBanner`.
- `src/pages/Marketplace.tsx`, `src/pages/MarketplaceBooking.tsx`, `src/pages/patient/PatientBooking.tsx` — filtrar `is_published`.
- Todos os arquivos que consultam `procedures` (lista no item 1).

## Fora do escopo
- Mudanças no fluxo Médico/Dentista (preserva-se inteiro).
- Edição da função `handle_new_user` (já cria a clínica corretamente).
- Notificações para operadoras sobre nova clínica publicada.
