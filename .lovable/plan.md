## Objetivo

Permitir que o dono/admin da clínica alterne entre dois "modos de uso" sem trocar de login:

- **Modo Gestor** (padrão atual): visão de clínica — financeiro, secretária IA, aprovações, credenciamentos, etc.
- **Modo Consulta**: visão do profissional (médico/dentista) — dashboard do dentista, minha agenda, disponibilidade, atendimento, odontograma, orçamentos, ferramentas — sem acesso a financeiro/secretária IA/clínica.

Botão fica no canto superior direito da home (ao lado da saudação "Bom dia, Lucas"), e também aparece como item compacto na sidebar.

---

## Comportamento

### 1. Detecção do perfil profissional do dono

No primeiro clique em "Modo Consulta", verificar em `clinic_members` (linha do owner na clínica atual) se já tem `specialty` e `registration_number` preenchidos.

- **Sem dados** → abrir `FirstConsultModeDialog` solicitando:
  - Especialidade (usa `SpecialtySelect` já existente)
  - Registro profissional (CRM, CRO, CRP, etc — label dinâmico via `registrationLabelForSpecialty`)
  - Ao salvar: `UPDATE clinic_members SET specialty=?, registration_number=? WHERE user_id=auth.uid() AND clinic_id=?` e `INSERT` em `professional_specialties` (is_primary=true) e `clinic_member_specialties`.
- **Com dados** → ativa direto.

### 2. Toggle visual

- Rótulo dinâmico:
  - Se o usuário **já é dentist** numa clínica (cadastro como médico): botão chama-se **"Modo Gestor"** (default = consulta, alterna para visão gestor).
  - Se é **admin/owner** sem ser dentista: botão chama-se **"Modo Consulta"** (default = gestor).
- Ícone `Stethoscope` ↔ `Building2`.
- Localização: header da home (`Index.tsx`/`DentistHome.tsx`/`MedicalHome.tsx`) + botão duplicado no rodapé da sidebar acima do usuário.

### 3. Persistência

Novo helper `viewMode.ts`:
- `getViewMode(userId, clinicId): 'manager' | 'consult'`
- `setViewMode(userId, clinicId, mode)`
- Storage: `localStorage` key `iaclin.viewMode.<userId>.<clinicId>`.

### 4. Aplicação do modo no roteamento

Em `useRoleAccess`:
- Calcular `effectiveRole`:
  - Se `viewMode === 'consult'` e o usuário tem qualquer papel admin/owner/dentist → `effectiveRole = 'dentist'`.
  - Se `viewMode === 'manager'` e o usuário é dentist+owner → `effectiveRole = 'admin'`.
- `useProfessionalLabel`, sidebar, mobile bottom nav, dashboards e command palette já consomem `effectiveRole` → ganham a troca automaticamente.
- Bloquear rotas `/financial`, `/secretaria-ia`, `/clinica/*` em consult mode (já segue regra `routePermissions` para `dentist`).

### 5. Home dinâmica

`src/pages/Index.tsx` já roteia para `DentistHome`/`MedicalHome`/`ClinicaHome` baseado em role. Como `effectiveRole` muda, a home certa aparece sem novo código.

---

## Arquivos a criar / editar

**Novos:**
- `src/lib/viewMode.ts` — helpers de persistência.
- `src/hooks/useViewMode.ts` — hook React (`viewMode`, `setViewMode`, `toggle`, `canSwitch`).
- `src/components/ViewModeToggle.tsx` — botão usado no header da home e na sidebar.
- `src/components/FirstConsultModeDialog.tsx` — coleta especialidade + registro no primeiro acesso.

**Editar:**
- `src/hooks/useRoleAccess.ts` — incorporar `viewMode` no cálculo de `effectiveRole`.
- `src/pages/Index.tsx` — renderizar `<ViewModeToggle/>` no topo direito da saudação.
- `src/pages/dentist/DentistHome.tsx`, `src/pages/medical/MedicalHome.tsx`, `src/pages/clinica/ClinicaHome.tsx` — mesmo toggle no header.
- `src/components/AppSidebar.tsx` — botão compacto acima do bloco do usuário (somente quando o usuário pode alternar).

**Sem mudanças de banco** — `clinic_members.specialty` e `registration_number` já existem.

---

## Fora de escopo

- Criar perfil profissional duplicado em outras clínicas.
- Cobrança/limite de profissionais quando o dono usa modo consulta (continua não contando como profissional extra).
- Mudar a categoria da clínica.
