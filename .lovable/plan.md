

# Plano: Mapas clínicos por especialidade (substituir Odontograma fixo)

## Conceito

Hoje "Odontograma" é fixo no menu. Vou transformar isso em um item dinâmico chamado **"Mapa Clínico"** que muda conforme a especialidade do médico logado (vinda de `clinic_members.specialty`). Cada paciente tem seu próprio mapa, com histórico salvo por região/parte clicada.

```text
Especialidade do médico       →  Mapa exibido
─────────────────────────────────────────────────────
Odontologia / Dentista        →  Odontograma (32 dentes) [já existe]
Podologia                     →  Mapa dos pés (10 dedos + planta/dorso)
Clínico Geral / Cardio / etc  →  Mapa corporal (cabeça, tórax, abdômen, membros)
Dermatologia                  →  Mapa corporal com foco em pele (zonas)
Nutricionista                 →  Diário alimentar (refeições do dia, não anatômico)
Fisioterapia / Ortopedia      →  Mapa musculoesquelético (articulações)
Ginecologia / Urologia        →  Sem mapa (esconde item do menu)
```

Se a especialidade do médico não tem mapa definido, o item **simplesmente não aparece** no menu nem na bottom nav.

## Mudança no banco

Generalizar `odontogram_entries` para suportar todos os mapas:

**Nova tabela** `clinical_map_entries`:
- `id`, `patient_id`, `clinic_id`, `dentist_id`
- `map_type` (`tooth` | `foot` | `body` | `meal` | `musculoskeletal`)
- `region_code` (texto: ex `tooth-18`, `foot-L-toe-1`, `body-chest`, `meal-breakfast-2026-04-23`, `joint-knee-R`)
- `condition` (texto livre por tipo, ex `cavity`, `callus`, `pain`, `kcal:450`)
- `severity` (`low|medium|high`, opcional)
- `notes`, `payload` (jsonb para dados específicos: ex calorias da refeição, força muscular)
- `created_at`, `updated_at`

RLS igual à atual (membros da clínica acessam, paciente vê os próprios via join). `odontogram_entries` continua existindo, mas o front passa a ler/escrever em `clinical_map_entries` com `map_type='tooth'`. Migração leve copiando registros antigos.

## Componentes novos

Pasta `src/components/clinical-map/`:

- `ClinicalMapPage.tsx` — orquestrador: detecta especialidade do médico, escolhe o mapa.
- `mapRegistry.ts` — mapa de `specialty → { mapType, label, component }`.
- `ToothMap.tsx` — refatora o conteúdo atual de `Odontogram.tsx` (já feito, só extrair o SVG).
- `FootMap.tsx` — SVG dos dois pés (vista plantar + dorsal), 10 dedos clicáveis + regiões (calcanhar, arco, antepé). Condições típicas: calo, micose, unha encravada, esporão, dor.
- `BodyMap.tsx` — SVG silhueta humana (frente/costas), regiões clicáveis: cabeça, pescoço, tórax, abdômen, lombar, braços, pernas. Condições: dor, lesão, cirurgia prévia, alergia local.
- `MealMap.tsx` — não anatômico: timeline do dia com 5 cards (café, lanche, almoço, lanche tarde, jantar), cada um abre dialog de itens + kcal + observação. Histórico semanal lateral.
- `MusculoskeletalMap.tsx` — SVG com articulações destacadas (ombros, cotovelos, punhos, quadril, joelhos, tornozelos) + grupos musculares. Para fisio/ortopedia.

Cada mapa segue a mesma interface:

```ts
interface ClinicalMapProps {
  patientId: string;
  entries: ClinicalMapEntry[];
  onRegionClick: (regionCode: string) => void;
  selectedRegion: string | null;
}
```

`ClinicalMapPage` cuida do dialog de condição, lista de "Histórico recente", legenda e seletor de paciente — tudo reutilizado da `Odontogram.tsx` atual.

## Registry de especialidades

```ts
// mapRegistry.ts
export const MAP_BY_SPECIALTY: Record<string, MapConfig> = {
  odontologia: { mapType: 'tooth', label: 'Odontograma', icon: Tooth },
  ortodontia:  { mapType: 'tooth', label: 'Odontograma', icon: Tooth },
  // ...todas odonto
  podologia:   { mapType: 'foot', label: 'Mapa Podológico', icon: Footprints },
  clinico_geral: { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding },
  cardiologia:   { mapType: 'body', label: 'Mapa Corporal', icon: PersonStanding },
  dermatologia:  { mapType: 'body', label: 'Mapa Dermatológico', icon: PersonStanding },
  nutricao:      { mapType: 'meal', label: 'Diário Alimentar', icon: Utensils },
  fisioterapia:  { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity },
  ortopedia:     { mapType: 'musculoskeletal', label: 'Mapa Musculoesquelético', icon: Activity },
  // ginecologia, psicologia, etc → não definidos = item escondido
};
```

## Sidebar e bottom nav dinâmicos

**`AppSidebar.tsx`** e **`MobileBottomNav.tsx`**:
- Ler `clinic_members.specialty` do médico logado.
- Resolver via `MAP_BY_SPECIALTY` → se existe, renderiza item com label/ícone certos apontando para `/mapa-clinico`.
- Se não existe, esconde o item.
- Admin/secretária da clínica continua vendo "Odontograma" só se a clínica for categoria `odonto` (regra atual preservada).

## Roteamento

- Manter `/odontograma` como atalho legado redirecionando para `/mapa-clinico`.
- Nova rota `/mapa-clinico` em `App.tsx` → renderiza `ClinicalMapPage`.

## Integração no atendimento

No `Attendance.tsx`, adicionar uma aba/seção "Mapa clínico" que abre o mapa do paciente atual já filtrado, para o médico marcar achados durante a consulta. Salva no mesmo `clinical_map_entries` com `appointment_id` opcional (vou adicionar essa coluna).

## Resumo do paciente (`AttendanceSummaryModal`)

Adicionar uma seção "Mapa clínico" que lista as alterações feitas naquele atendimento (filtrando entries com `appointment_id` igual), mostrando o tipo de mapa do médico que atendeu.

## Arquivos tocados

**Novos**
- `supabase/migrations/<timestamp>_clinical_map_entries.sql`
- `src/components/clinical-map/ClinicalMapPage.tsx`
- `src/components/clinical-map/mapRegistry.ts`
- `src/components/clinical-map/ToothMap.tsx` (extraído do Odontogram atual)
- `src/components/clinical-map/FootMap.tsx`
- `src/components/clinical-map/BodyMap.tsx`
- `src/components/clinical-map/MealMap.tsx`
- `src/components/clinical-map/MusculoskeletalMap.tsx`

**Editados**
- `src/pages/Odontogram.tsx` → vira wrapper fino que chama `ClinicalMapPage`
- `src/components/AppSidebar.tsx` (item dinâmico)
- `src/components/MobileBottomNav.tsx` (item dinâmico)
- `src/App.tsx` (rota `/mapa-clinico`)
- `src/pages/Attendance.tsx` (aba mapa)
- `src/components/attendance/AttendanceSummaryModal.tsx` (seção mapa)

## O que NÃO muda

- Tabela `odontogram_entries` continua acessível (para não quebrar histórico existente; o front lê das duas e mescla durante transição).
- Regra de "Odontograma só em clínica `odonto`" continua valendo para admins/secretárias.
- RLS já cobre o caso (mesma estrutura `patient_id` + `clinic_id`).

## Resultado esperado

- Joel (cardiologia) loga → vê item "Mapa Corporal" no menu, abre paciente Flávio → marca dor no peito como achado.
- Um podólogo loga → vê "Mapa Podológico" → marca calo no dedão direito do paciente.
- Uma nutricionista loga → vê "Diário Alimentar" → registra refeições do paciente.
- Um dentista loga → continua vendo "Odontograma" do jeito que já era.
- Um ginecologista loga → não vê item de mapa nenhum (não polui o menu).

