## Objetivo

Permitir que o médico/dentista atenda **com ou sem vínculo a uma clínica**, marcando cada paciente/agendamento individualmente como "vinculado à clínica X" ou "atendimento pessoal (não vinculado)". Tudo aparece numa lista única com **badge visual** indicando a origem, sem vazar dados entre médicos.

## Conceito

- Hoje toda linha (`patients`, `appointments`, `budgets`, `clinical_records`, `financial_transactions`) tem `clinic_id` opcional. Quando `clinic_id IS NULL`, a RLS atual deixa qualquer autenticado ver — isso é inseguro e vai mudar.
- Nova regra: **`clinic_id IS NULL` = atendimento pessoal do médico**, dono = `dentist_id`. Só esse médico (e quem ele autorizar futuramente) enxerga.
- Médico vê numa lista unificada: pacientes/agendas das clínicas onde é membro **+** seus pessoais. Cada item ganha um badge: nome da clínica (azul/cinza) ou "Pessoal" (âmbar).
- Para admin/secretária de clínica: continua vendo só o que tem `clinic_id` da clínica ativa (sem mudança).

## Mudanças

### 1. Banco (migração)

Reforçar RLS para que `clinic_id IS NULL` seja restrito ao próprio dentista. Tabelas afetadas: `patients`, `appointments`, `clinical_records`, `clinical_map_entries`, `treatment_plans`, `treatment_plan_items`, `financial_transactions`, `anamneses`, `documents`.

Padrão das policies SELECT/INSERT/UPDATE:
```sql
-- Substitui: (clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id)
-- Por:
(clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
OR
(clinic_id IS NULL AND dentist_id = auth.uid())
```

Para tabelas-filhas sem `dentist_id` direto (`treatment_plan_items`, `clinical_record_procedures`, `clinical_record_requests`, `documents`, `anamneses`): herdar via JOIN no pai (`treatment_plans.dentist_id`, `clinical_records.dentist_id`, `patients.dentist_id` se aplicável).

`patients` ganha coluna `dentist_id uuid` (nullable; preenchida quando é paciente pessoal). Trigger/check: se `clinic_id IS NULL` então `dentist_id IS NOT NULL`.

Backfill: linhas existentes com `clinic_id IS NULL` recebem o `dentist_id` do primeiro `appointment` ou são associadas ao owner da única clínica do usuário.

### 2. AuthContext

- Adicionar flag derivada `currentScope: { type: 'clinic' | 'personal', clinicId: string | null }`.
- Novo método `setScope('clinic' | 'personal')` que persiste em `localStorage`.
- Para dentistas, o `ClinicSwitcher` agora lista:
  - "Atendimentos Pessoais" (sempre disponível para quem tem role `dentist`)
  - Cada clínica vinculada
- Quando `scope = personal`, queries usam `clinic_id IS NULL AND dentist_id = user.id`.
- Quando `scope = clinic`, queries usam `clinic_id = currentClinicId` (comportamento atual).

### 3. ClinicSwitcher

Reescrever para mostrar:
- Item topo (âmbar, ícone `User`): **"Atendimentos Pessoais"** — disponível para qualquer usuário com role `dentist`, mesmo sem clínica própria.
- Separador.
- Lista de clínicas vinculadas (ícone `Building2`).
- Trigger reflete escopo ativo (âmbar quando pessoal, padrão quando clínica).

### 4. Listagens unificadas (visão "tudo junto")

Adicionar um modo "Ver tudo" no escopo do dentista:
- Em `Patients.tsx`, `PatientsOfDay.tsx`, `Agenda.tsx`, `Budgets.tsx`: toggle no header "Apenas escopo atual / Ver tudo (clínicas + pessoal)".
- Quando "Ver tudo" ativo, query traz: `clinic_id IN (minhas clínicas) OR (clinic_id IS NULL AND dentist_id = me)`.
- Cada linha/card recebe badge:
  - Pessoal → badge âmbar `User` "Pessoal"
  - Clínica → badge cinza `Building2` com nome curto da clínica
- Cores via tokens semânticos (não hardcoded).

### 5. Criação/edição

- `PatientFormDialog`, `AppointmentFormDialog`, `BudgetFormDialog`: novo seletor "Vincular a:" com opções "Pessoal (sem clínica)" + cada clínica do médico. Default = escopo atual do switcher.
- Ao salvar com "Pessoal": `clinic_id = null`, `dentist_id = auth.uid()`.

### 6. Header global

Substituir o badge atual `isPersonalMode` (que dependia de `is_owner`) por um badge baseado no novo `currentScope.type === 'personal'`. Texto: "Modo Pessoal".

## Não inclui

- Não cria nova tabela paralela — reusa as existentes com `clinic_id NULL`.
- Não muda fluxo de admin/secretária.
- Sem compartilhamento de pacientes pessoais entre médicos (futuro).
- Sem mudança no marketplace público.

## Resultado

Dr. Joel abre o switcher → escolhe "Atendimentos Pessoais" (atende particulares) ou uma das clínicas vinculadas. Pode também ativar "Ver tudo" e ver pacientes/agenda/orçamentos de todos os escopos numa lista única, com badge âmbar "Pessoal" ou cinza "Clínica X" em cada item. Ao criar paciente/consulta, escolhe explicitamente onde vincular. RLS garante que pacientes pessoais de um médico nunca aparecem para outro médico nem para clínicas onde ele só é vinculado.