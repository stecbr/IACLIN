## Objetivo

Permitir que o médico/dentista alterne facilmente entre **Pacientes da Clínica** (cada clínica onde ele é membro) e **Meus Pacientes** (clínica própria, criada no cadastro como owner), com **separação visual clara** e **isolamento total de dados** entre escopos.

## Conceito

- "Meus Pacientes" = pacientes da clínica onde o médico é `owner` (criada no signup como `profissional`).
- "Pacientes da Clínica X" = pacientes das demais clínicas onde ele é membro (não-owner).
- Como já existe `currentClinicId` no `AuthContext` e isolamento por `clinic_id` em todas as queries (RLS já garante), basta tratar a clínica própria como um item especial visualmente diferenciado no `ClinicSwitcher`.

## Mudanças

### 1. `src/components/ClinicSwitcher.tsx`
- Reordenar lista: clínica própria (`is_owner = true` E o usuário tem role `dentist`) aparece no topo, separada por `DropdownMenuSeparator`, com label **"Modo Pessoal"** e ícone diferente (ex: `User` em âmbar) em vez de `Building2`.
- Demais clínicas listadas abaixo sob label **"Clínicas vinculadas"**.
- Quando a clínica ativa for a "pessoal", o trigger usa cor de destaque âmbar (`bg-amber-500/10`, ícone `User`, label "Meus Pacientes" no lugar do nome da clínica).
- Mostrar o switcher mesmo se houver apenas 1 membership, desde que o médico tenha clínica própria + ao menos 1 vínculo (caso atual exige `> 1`, manter).

### 2. Indicador global de "Modo Pessoal"
- Novo componente `PersonalModeBadge` no header (`AppLayout`): badge âmbar fixo "Modo Pessoal" quando a clínica ativa é a própria do médico. Discreto, ao lado do `SidebarTrigger`.
- Aplicado apenas para `effectiveRole === 'dentist'`.

### 3. Páginas afetadas (apenas visual — lógica já filtra por `currentClinicId`)
- `Patients.tsx`, `PatientsOfDay.tsx`, `Agenda.tsx`, `Budgets.tsx`: adicionar uma faixa fina/badge no `PageHeader` mostrando o escopo atual ("Modo Pessoal" em âmbar / nome da clínica em padrão).
- Sem alteração nas queries — o `currentClinicId` já isola os dados via RLS.

### 4. Helper no `AuthContext`
- Expor flag derivada `isPersonalMode = currentMembership?.is_owner && roles.includes('dentist')`.
- Usado pelo badge e pelo switcher para destacar.

## Não inclui
- Sem mudanças de schema (a clínica pessoal já existe via fluxo `profissional` em `handle_new_user`).
- Sem mudanças nas RLS — isolamento já é por `clinic_id`.
- Sem botão extra fora do `ClinicSwitcher` (a alternância vive lá, conforme escolhido).

## Resultado
Médico clica no switcher da sidebar → escolhe "Meus Pacientes" (destacado em âmbar) ou uma das clínicas vinculadas. Toda a UI (Pacientes, Agenda, Pacientes do Dia, Orçamentos) recarrega filtrada para aquele escopo, com badge âmbar visível indicando "Modo Pessoal" para evitar confusão. Nenhum dado vaza entre escopos pois a RLS já filtra por `clinic_id`.