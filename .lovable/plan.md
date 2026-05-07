## Objetivo

Personalizar o cabeçalho da Home de acordo com quem está logado:

- **Médico / Dentista (e demais profissionais)**: `Olá, Dr(a). {Nome} 👋 — Seja bem-vindo(a) — {Especialidade}`
- **Clínica (admin/dono)**: `Olá, {Nome da Clínica} 👋 — Seja bem-vindo(a)` com descrição contextual
- **Paciente**: sem alteração

## Onde alterar

Existem 5 telas Home que renderizam a saudação via `PageHeader`:

1. `src/pages/Index.tsx` → `AdminHome` (clínica/admin)
2. `src/pages/dentist/DentistHome.tsx` (odonto / fisio / podo / genérico)
3. `src/pages/medical/MedicalHome.tsx`
4. `src/pages/nutrition/NutritionHome.tsx`
5. `src/pages/psi/PsiHome.tsx`

## Mudanças

### 1. AdminHome (`src/pages/Index.tsx`)

- Em vez de usar `profile.full_name`, usar o **nome da clínica atual** vindo de `useAuth()` (`clinics.find(c => c.clinic_id === currentClinicId)?.clinic_name`).
- Título: `${getGreeting()}, ${clinicName} 👋`
- Descrição: `Seja bem-vindo(a)! Aqui está o resumo da sua clínica hoje.`
- Fallback se não houver clínica: usar `firstName` como hoje.

### 2. Homes de profissional (Dentist/Medical/Nutrition/Psi)

- Resolver a especialidade do profissional logado a partir de `clinic_members.specialty` (via hook existente `useSpecialtyProfile` — já disponível) e converter para rótulo legível usando `specialtyLabel()` de `src/components/SpecialtySelect.tsx`.
- Construir título no formato:
  - `${getGreeting()}, Dr(a). ${firstName} 👋`
- Descrição (substitui a atual):
  - `Seja bem-vindo(a) · ${especialidadeLegível} — ${descrição original da tela}`
  - Quando não houver especialidade cadastrada, ocultar o trecho da especialidade.
- Padronizar o prefixo "Dr(a)." em todas as homes profissionais (hoje só `MedicalHome` usa). Para `PsiHome`/`NutritionHome` mantemos os emojis temáticos (🧠 / 🥗) ao final do título.

### 3. Paciente

- Sem alteração (conforme pedido).

## Detalhes técnicos

- `useSpecialtyProfile()` já retorna `{ specialty }` (id armazenado em `clinic_members`). Importar `specialtyLabel` de `@/components/SpecialtySelect` para exibir o nome amigável (ex.: "Ortodontia", "Cardiologia").
- Em `AdminHome`, usar `clinics` + `currentClinicId` do `useAuth()` (já consumido na página) — sem nova consulta ao backend.
- Não há mudanças de schema, RLS ou rotas.

## Resultado esperado

- Dentista logado vê: `Boa tarde, Dr(a). João 👋` com subtítulo `Seja bem-vindo(a) · Ortodontia — Aqui está o resumo do seu dia.`
- Clínica/admin vê: `Boa tarde, Clínica Sorriso 👋` com subtítulo `Seja bem-vindo(a)! Aqui está o resumo da sua clínica hoje.`
- Paciente: inalterado.
