

# Plano: Clicar no nome do paciente na Agenda → abrir ficha do paciente

Hoje, ao clicar num agendamento na Agenda, abre o `AppointmentDetailDialog`. O nome do paciente aparece dentro do dialog mas não é clicável. Quero deixar o nome do paciente como um **link** que leva direto pra ficha completa dele em `/patients/:id` (a rota já existe).

## O que muda

### 1. No `AppointmentDetailDialog.tsx`

Transformar o bloco do paciente (linhas 112-118) em um **botão clicável**:

- Hover muda o background levemente, ícone do `User` e nome ganham cor primária.
- Aparece um pequeno ícone `ChevronRight` à direita indicando "vai pra algum lugar".
- Tooltip: *"Ver ficha completa do paciente"*.
- Ao clicar: fecha o dialog e navega pra `/patients/{appointment.patient_id}`.
- **Só fica clicável** se `effectiveRole !== 'patient'` (paciente não pode ver ficha de outros pacientes — embora hoje paciente nem usa essa tela, é um guard preventivo).

### 2. Tornar o link mais descobrível também na grade da Agenda (opcional, dentro do mesmo card)

No card do agendamento (`Agenda.tsx`, dentro do loop `dayApts.map`), o nome do paciente já está em destaque. Vou adicionar um sutil **`hover:underline`** no nome quando o cursor passar — sinaliza que dá pra interagir, mas o clique no card todo continua abrindo o dialog (não muda o comportamento atual). O atalho direto pra ficha fica dentro do dialog, que é o lugar natural pra "drill down".

### 3. Mesma melhoria no `MonthView` da Agenda

O modo Mês mostra só o primeiro nome do paciente. Mantém o mesmo comportamento (clicar abre o dialog), e dentro do dialog o usuário acessa a ficha. Sem mudança aqui.

### 4. Mesma melhoria no `AgendaCompareView.tsx`

Os cards de agendamento na visão "Comparar lado a lado" usam o mesmo `AppointmentDetailDialog` no clique → automaticamente herdam o link pra ficha. Sem mudança no arquivo.

## Visual

Antes:
```
┌─────────────────────────────────────┐
│ 👤  Gabriela Ferreira               │
│     Paciente                        │
└─────────────────────────────────────┘
```

Depois:
```
┌─────────────────────────────────────┐
│ 👤  Gabriela Ferreira          ›    │  ← clicável, hover destaca
│     Ver ficha completa              │
└─────────────────────────────────────┘
```

## Permissões

- **Admin / Secretária / Médico**: link ativo, vai pra `/patients/:id`.
- **Paciente** (modo simulado ou real): link desativado (renderiza como texto comum). RLS já bloquearia o acesso de qualquer forma; isso é só pra UX não oferecer um caminho que vai dar 403.

## Arquivos tocados

- **Editado**: `src/components/agenda/AppointmentDetailDialog.tsx` — bloco do paciente vira botão; usa `useRoleAccess` pra checar permissão; navega via `navigate()` (já importado).

## O que NÃO muda

- Rota `/patients/:id` e página `PatientDetail.tsx`: já existem, sem alteração.
- Banco, RLS, edge functions: zero mudanças.
- Comportamento de clique no card da grade: continua abrindo o dialog (não pula direto pra ficha — o dialog é o ponto de entrada pra ações: status, iniciar atendimento, cancelar, e agora também ver ficha).
- `Agenda.tsx`, `AgendaCompareView.tsx`, `MonthView`: nenhuma mudança de código.

