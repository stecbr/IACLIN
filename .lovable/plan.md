# Personalização completa por especialidade

## O problema

Hoje todo profissional não-odonto/não-psi cai numa tela genérica que herda visual e ferramentas de odontologia: cirurgião plástico vê "Atlas de Dentes", nutricionista veria os mesmos dentes, clínico geral também. Precisamos de uma **trilha por família clínica**, com dashboard, ferramentas, mapa, terminologia e catálogo próprios.

## Estratégia: agrupar por famílias clínicas

Em vez de criar uma tela por especialidade (60+), agrupamos por **família** com ferramentas comuns. Cada família tem: Home com KPIs próprios, ToolsHome próprio, Mapa Clínico, catálogo de procedimentos filtrado, terminologia ("paciente"/"cliente", "consulta"/"sessão") e ícone/acento visual.

### Famílias (sem veterinário)

| Família | Especialidades | Mapa | Ferramentas-chave |
|---|---|---|---|
| **Odontologia** *(já existe)* | Dentista, Orto, Endo, Perio, Implanto, Odontoped, Bucomaxilo | Odontograma | Atlas de dentes, Anestésico odonto |
| **Estética / Cir. Plástica** *(já existe)* | Cir. Plástica, Dermato estética | Mapa Corporal | Calc. Botox, Áreas faciais, Foto antes/depois |
| **Psicologia / Saúde Mental** *(já existe)* | Psico, Psiquiatria, Psicanálise, Neuropsico | Mapa Psíquico | Escalas (PHQ-9, GAD-7), Diário de Humor, SOAP |
| **Médico Clínico** *(novo)* | Clínico Geral, Cardio, Pneumo, Endócrino, Gastro, Neuro, Pediatria, Geriatria, Infecto, Reumato, Hemato, Nefro, Gineco, Urologia | Mapa Corporal | Risco cardiovascular, IMC/SC, CID-10, Receituário |
| **Nutrição** *(novo)* | Nutrição, Nutrólogo | Diário Alimentar | IMC + circunferências, Recordatório 24h, Plano alimentar, Equivalentes |
| **Fisio / Reabilitação** *(novo)* | Fisioterapia, Ortopedia, RPG, Quiropraxia | Musculoesquelético | Goniômetro, Escala EVA, Testes ortopédicos |
| **Podologia** *(novo)* | Podologia | Mapa do Pé | Risco diabético, Curativos, Áreas do pé |
| **Genérico** *(novo)* | Fono, T. Ocupacional, Acupuntura, Homeopatia e demais | Mapa Corporal | Receituário, Atestado, Foto, Voz, Timer |

Mapas já existem no `mapRegistry.ts` para todas. Falta a camada de Home + ToolsHome + filtragem de catálogo.

---

## Plano de implementação

### 1. Helper central de família (`src/lib/specialtyFamily.ts` — novo)

Ponto único de verdade que recebe a `specialty` do `clinic_members` e devolve:

```ts
type SpecialtyFamily =
  | 'odonto' | 'aesthetic' | 'psi' | 'medical'
  | 'nutrition' | 'physio' | 'podology' | 'generic';

interface FamilyConfig {
  family: SpecialtyFamily;
  label: string;            // "Cirurgião Plástico", "Nutricionista"…
  homeRoute: string;
  toolsRoute: string;
  patientNoun: string;      // "paciente" | "cliente"
  appointmentNoun: string;  // "consulta" | "sessão" | "atendimento"
  accentColor: string;
  registrationLabel: 'CRO'|'CRM'|'CRN'|'CRP'|'CREFITO'|'CR';
}
```

`getSpecialtyFamily(specialtyId)` cobre todas as 60+ especialidades já catalogadas em `SpecialtyStep.tsx`.

### 2. Roteador de Home dinâmico

`src/pages/Index.tsx` hoje só tem 2 ramos. Trocar por:

```text
IndexRouter
 ├─ patient → PatientHome
 ├─ admin/secretary → AdminHome (sem mudança)
 └─ dentist (profissional clínico)
      └─ switch family
           ├─ odonto      → DentistHome (atual)
           ├─ psi         → PsiHome (novo)
           ├─ aesthetic   → AestheticHome (novo)
           ├─ nutrition   → NutritionHome (novo)
           ├─ physio      → PhysioHome (novo)
           ├─ medical     → MedicalHome (novo)
           ├─ podology    → PodologyHome (novo)
           └─ generic     → GenericClinicianHome (novo)
```

Cada Home reusa um `ProfessionalHomeBase` (esqueleto de KPIs + agenda do dia + aniversariantes + próximas) com:
- Linguagem certa ("Sessões hoje", "Clientes ativos")
- KPIs próprios: nutrição mostra "Planos alimentares ativos"; psi mostra "Sessões esta semana"; estética mostra "Procedimentos do mês"; fisio mostra "Sessões realizadas".
- Atalhos para as ferramentas da família.

### 3. ToolsHome por família

Já existem 3: `ToolsHome` (odonto), `AestheticToolsHome`, `PsiToolsHome`. Faltam:

- **NutritionToolsHome**: IMC + circunferências, Recordatório 24h, Lista de equivalentes, Plano alimentar PDF, Receituário, Atestado, Foto, Voz.
- **PhysioToolsHome**: Goniômetro, EVA, Testes ortopédicos rápidos (Lasègue, Phalen…), Receituário, Atestado, Timer, Voz.
- **MedicalToolsHome**: Risco cardiovascular (Framingham simplificado), IMC/SC, CID-10 busca, Receituário, Atestado, Foto, Voz, Timer.
- **PodologyToolsHome**: FootMap reusado, questionário de risco diabético, guia de curativos, Receituário, Atestado, Foto, Voz.
- **GenericToolsHome**: só ferramentas neutras (Receituário, Atestado, Foto, Voz, Timer, Próximo Retorno).

Cada uma tem ~80 linhas (padrão do `AestheticToolsHome`). Componentes pesados ficam em `src/components/<family>/`.

### 4. Sidebar e Mobile Nav dinâmicos

`AppSidebar.tsx` já tem lógica para psi/estética. Generalizar via `getSpecialtyFamily`:
- "Ferramentas Clínicas" → `family.toolsRoute`.
- "Mapa Clínico" → `getMapForSpecialty` (já cobre tudo).
- "Odontograma" continua só para `family === 'odonto'`.
- "Orçamentos" continua para todos exceto psi.
- `MobileBottomNav.tsx`: mesmo tratamento no item "Mais".

### 5. Catálogo de procedimentos por família

Coluna `procedures.specialty_category` já existe. Refinar:
- Inserir catálogos iniciais (~10 procedimentos cada) para nutrição, fisio, médico clínico e podologia.
- `BudgetFormDialog` já filtra; passa a derivar a categoria via `getSpecialtyFamily`.
- Esconder campo "Dente" sempre que `family !== 'odonto'`.

### 6. Limpezas

- `Profile.tsx`: label do registro vira dinâmica (CRO/CRM/CRN/CRP/CREFITO).
- Varrer textos "consulta odontológica", placeholders odonto e neutralizar onde fizer sentido.

---

## Detalhes técnicos

**Arquivos novos:**
- `src/lib/specialtyFamily.ts`
- `src/components/dashboard/ProfessionalHomeBase.tsx`
- `src/pages/medical/MedicalHome.tsx` + `MedicalToolsHome.tsx`
- `src/pages/nutrition/NutritionHome.tsx` + `NutritionToolsHome.tsx`
- `src/pages/physio/PhysioHome.tsx` + `PhysioToolsHome.tsx`
- `src/pages/podology/PodologyHome.tsx` + `PodologyToolsHome.tsx`
- `src/pages/aesthetic/AestheticHome.tsx` (ToolsHome já existe)
- `src/pages/psi/PsiHome.tsx` (ToolsHome já existe)
- `src/pages/generic/GenericClinicianHome.tsx` + `GenericToolsHome.tsx`
- Componentes:
  - `src/components/medical/RiskCalculator.tsx`, `BmiBsa.tsx`, `Cid10Search.tsx`
  - `src/components/nutrition/ImcCalculator.tsx`, `Recall24h.tsx`, `MealPlanBuilder.tsx`, `FoodEquivalents.tsx`
  - `src/components/physio/Goniometer.tsx`, `PainScale.tsx`, `OrthoTests.tsx`
  - `src/components/podology/DiabeticRisk.tsx`, `WoundGuide.tsx`

**Arquivos editados:**
- `src/pages/Index.tsx` (roteador por família)
- `src/components/AppSidebar.tsx`
- `src/components/MobileBottomNav.tsx`
- `src/components/budgets/BudgetFormDialog.tsx`
- `src/pages/Profile.tsx`
- `src/App.tsx` (registrar novas rotas)
- `src/hooks/useRoleAccess.ts` (liberar para `dentist`)

**Migração SQL:** INSERT dos catálogos iniciais (~40 procedimentos para 4 famílias novas).

**Sem mudanças em:** signup, RBAC, edge functions, config.toml, auth.

---

## Resultado esperado

| Profissional | O que vê ao logar |
|---|---|
| Cirurgião plástico | Home estética, Mapa Corporal, Botox/Áreas/Foto, catálogo de cir. plástica. **Zero dente.** |
| Nutricionista | Home nutrição, Diário Alimentar, IMC + Recordatório + Plano alimentar. **Zero dente, zero anestésico.** |
| Clínico geral | Home médica, Mapa Corporal, Risco CV + CID-10 + IMC, consultas médicas. |
| Fisioterapeuta | Home fisio, Musculoesquelético, Goniômetro + EVA + testes. |
| Podólogo | Home podologia, Mapa do Pé, Risco diabético + curativos. |
| Psicólogo | (já existente) Home psi, Mapa Psíquico, Escalas + SOAP. |
| Dentista | (já existente) Home odonto, Odontograma, Atlas + anestésico. |
| Genérico (fono/TO/etc.) | Home neutra, Mapa Corporal, ferramentas universais. |

A regra "**não vê o que não é seu**" passa a valer pra todo o app.

## Tamanho

Trabalho grande mas mecânico — repete 5x o padrão "Home + ToolsHome + componentes". Posso entregar em **uma única implementação** se aprovado.