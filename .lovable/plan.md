## Objetivo

A especialidade deixa de ser configuração da clínica e passa a ser **dado pessoal do médico** (múltiplas). A clínica passa a escolher, **por médico**, qual subconjunto dessas especialidades ele atende ali.

## Mudanças de modelo (banco)

1. Nova tabela `professional_specialties` (especialidades pessoais do usuário, válidas em todas as clínicas):
   - `user_id` (FK auth.users), `specialty` (text, id do catálogo), `is_primary` (bool), únique (`user_id`, `specialty`).
   - RLS: o próprio usuário pode CRUD; admin/owner de uma clínica onde ele é membro pode ler.
   - Migração de dados: cada `clinic_members.specialty` não nulo vira uma linha `professional_specialties` (marcada `is_primary` se for a primeira para o user).

2. Nova tabela `clinic_member_specialties` (subset por clínica):
   - `clinic_member_id` (FK clinic_members), `specialty` (text), unique (`clinic_member_id`, `specialty`).
   - RLS: admin/owner da clínica e o próprio membro CRUD; leitura pelos membros da clínica.
   - Migração: cada `clinic_members.specialty` vira uma linha aqui também.

3. `clinic_members.specialty` é mantido temporariamente (não removido) e passa a refletir a "especialidade primária na clínica" — derivada de `clinic_member_specialties`. Isto evita quebrar buscas/PDFs/marketplace que ainda lêem essa coluna nesta iteração. Um trigger mantém `clinic_members.specialty` = primeira de `clinic_member_specialties` (ou null).

## Mudanças de UI

### Profile.tsx (Meu Perfil)
- Substituir o `<Input>` por uma lista de `SpecialtySelect` com botão "+ Adicionar especialidade", marcação de "primária" (radio), e remoção por item.
- Salva em `professional_specialties`.
- Mantém o campo de registro (CRO/CRM) único — o label é definido pela especialidade primária.

### Configurações da clínica → Especialidade (`SpecialtySection.tsx`)
- Renomear seção para **"Especialidades atendidas nesta clínica"**.
- Mostra as especialidades pessoais do usuário (de `professional_specialties`) como checkboxes; marcadas = atendidas nesta clínica (gravadas em `clinic_member_specialties`).
- Mensagem se o usuário ainda não tem nenhuma pessoal: link para "Meu Perfil".

### Clínica → Médicos (`ClinicaMedicos.tsx`)
- Para cada médico da clínica (apenas admin/owner), botão "Especialidades nesta clínica" abrindo um diálogo com checkboxes das especialidades pessoais daquele médico, gravando em `clinic_member_specialties`.
- A lista exibida do médico passa a mostrar as especialidades atendidas na clínica (juntando `clinic_member_specialties` quando existir, com fallback em `clinic_members.specialty`).

### Sem mudança nesta iteração
- `Marketplace.tsx`, PDFs (`generate*Pdf.ts`), `useSpecialtyProfile`, `MobileBottomNav`, `AppSidebar`, `BudgetFormDialog`, `ClinicalMapPage`, `useAiSync`, `WaitingRoom`, `Auth.tsx`, `AddMedicoDialog`: continuam lendo `clinic_members.specialty` (mantido pelo trigger).

## Arquivos a editar
- nova migração SQL (tabelas, RLS, trigger, backfill)
- `src/pages/Profile.tsx`
- `src/components/settings/SpecialtySection.tsx`
- `src/pages/clinica/ClinicaMedicos.tsx` (+ novo `EditDoctorSpecialtiesDialog.tsx`)

## Fora de escopo (próxima iteração, se você quiser)
- Migrar `Marketplace`, PDFs e perfil de UX (`useSpecialtyProfile`) para usar arrays multi-especialidade.
- Remover a coluna `clinic_members.specialty`.
