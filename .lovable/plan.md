## Reformulação da Disponibilidade

### 1. Modelo de dados (migration)

Nova tabela `professional_schedule_template` (padrão semanal por profissional + escopo):

```text
professional_schedule_template
- id, user_id, clinic_id (nullable = pessoal/particular)
- weekday (0-6)
- start_time, end_time              -- turno principal
- breaks jsonb                      -- [{start:"12:00",end:"13:00",label:"Almoço"}, ...]
- mode text                         -- 'particular' | 'plano' | 'ambos'
- accepted_plan_ids uuid[]          -- opcional, vazio = todos
- slot_duration_minutes int         -- duração da consulta
- is_active bool
```

Manter `professional_availability` (exceções por data: feriados, dias extras, bloqueios).
Adicionar coluna `mode` e `breaks jsonb` em `professional_availability` para overrides pontuais.

Settings globais por profissional (em `clinic_members` ou nova `professional_settings`):
- `default_slot_duration` (int, min) — única para o profissional.

### 2. Nova UI: `/disponibilidade` com 3 abas

**Aba 1 — Padrão Semanal**
- Tabela seg→dom. Para cada dia:
  - Switch ativo/inativo
  - Turno: HH:MM → HH:MM (pode adicionar 2º turno se quiser tarde)
  - Intervalos: lista de `[início → fim, rótulo]` com botão "+ adicionar pausa"
  - Modo: chips `Particular` / `Plano` / `Ambos`
  - Se `Plano` ou `Ambos` + dentista vinculado a clínica: multi-select de clínicas/planos aceitos
- Botão "Replicar segunda em todos os dias úteis"

**Aba 2 — Duração & Configurações**
- Input: "Duração padrão da consulta" (15/20/30/45/60 min)
- Buffer automático entre consultas (opcional, default 0)
- Antecedência mínima de agendamento

**Aba 3 — Calendário & Exceções** (a atual reaproveitada)
- Calendário mensal mostrando o padrão aplicado + exceções
- Clicar num dia abre painel para sobrescrever (feriado, dia extra, bloqueio, modo diferente)
- Badge no dia indicando: 🟢 Particular | 🔵 Plano | 🟣 Ambos

### 3. Componentes novos

```text
src/components/availability/
  WeeklyTemplateTab.tsx        (novo)
  WeekdayRow.tsx               (novo - linha de dia com turnos/pausas/modo)
  BreaksEditor.tsx             (novo - intervalos múltiplos)
  ModeSelector.tsx             (novo - Particular/Plano/Ambos + planos aceitos)
  DurationSettingsTab.tsx      (novo)
  ExceptionsTab.tsx            (refator do atual AvailabilityCalendar + DayShiftsPanel)
```

### 4. Como o motor de agendamento usa

Geração de slots = `template_do_weekday` MENOS `breaks` MENOS `appointments` MENOS `bloqueios` MAIS `exceções extras`, partido em janelas de `slot_duration_minutes`.

Filtro por modo:
- Paciente "particular" → slots `particular` ou `ambos`
- Paciente com plano X → slots `plano`/`ambos` cujo `accepted_plan_ids` inclua X (ou vazio)

### 5. Escopo desta entrega

- Migration: nova tabela + colunas + RLS (membro da clínica ou dono pessoal)
- UI 3 abas funcionando (CRUD do template, duração, exceções)
- Compatibilidade: agenda/booking continuam lendo `professional_availability` no curto prazo; geração de slots a partir do template fica como segundo passo (registro a ser pré-populado a partir do template via função SQL `generate_availability_from_template(month)`).
- Não alteramos ainda os steps do paciente (`ClinicDoctorStep`/`DateStep`) — fica para iteração seguinte assim que o template estiver populado.

### 6. Fora de escopo (próxima iteração)
- Reescrever o fluxo de booking para respeitar `mode` + planos
- Comissionamento diferenciado particular vs plano
- Cotas por turno