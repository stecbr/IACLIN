# Pontos de acesso ao Prontuário do paciente

A tela de **Prontuário** é a `PatientDetail` (`/patients/:id`), que já abre o **Resumo do paciente com abas** (Info, Anamnese, Consultas, Documentos, Timeline, etc.). A tela `Attendance` (`/atendimento/:appointmentId`) continua sendo o **registro da consulta atual** — separada do prontuário.

A meta é garantir que o médico/dentista chegue ao prontuário a partir de **todos os contextos** onde ele pensa em "ver o paciente".

## Onde adicionar / padronizar o acesso

### 1. Agenda (já existe parcialmente — padronizar)
- `AppointmentDetailDialog`: já tem botão "Abrir paciente" → `/patients/:id`. **Renomear para "Abrir prontuário"** com ícone `FileText` para deixar claro.
- Card do agendamento na grade da Agenda: adicionar ação rápida (menu de 3 pontinhos) com **"Abrir prontuário"** sem precisar abrir o dialog.

### 2. Lista de Pacientes (já existe)
- `Patients.tsx`: linha clicável já navega para `/patients/:id`. Adicionar ícone visível de prontuário na coluna de ações para reforçar a affordance.

### 3. Sala de Espera (já existe — reforçar)
- `WaitingRoomCard`: botão "Abrir paciente" já existe. **Renomear para "Prontuário"** + manter "Iniciar atendimento" separado.

### 4. Pacientes do Dia (já existe — reforçar)
- `PatientsOfDay` / `DayAppointmentRow`: padronizar dois botões lado a lado: **"Prontuário"** (`/patients/:id`) e **"Atender"** (`/atendimento/:id`).

### 5. Botão global "Abrir prontuário" (novo)
- Adicionar item no **AppSidebar** (abaixo de "Pacientes"): "Abrir prontuário" → abre um **PatientPickerDialog** (busca por nome/CPF) e navega para `/patients/:id` ao selecionar.
- Adicionar entrada no **Command Palette (Cmd+K)**: "Abrir prontuário de…" com busca direta.

### 6. Dentro do Atendimento (novo)
- No header da tela `Attendance`, adicionar link **"Ver prontuário completo"** ao lado do nome do paciente, que abre `/patients/:id` em nova aba (`target="_blank"`) — assim o profissional consulta histórico sem perder o atendimento em curso.

### 7. Home do Dentista (novo)
- `DentistHome.tsx`: na seção "Próximos pacientes", cada card ganha ação **"Prontuário"** além de "Atender".

## Tela de destino: Resumo do paciente com abas
- Confirmado: ao clicar em qualquer entrada acima, abre `PatientDetail` (`/patients/:id`).
- A primeira aba ativa será **"Resumo"** (Info + alertas + últimas consultas). Demais abas: Anamnese, Consultas, Documentos, Odontograma (quando aplicável), Timeline, Financeiro.
- Botão fixo no topo da `PatientDetail`: **"Iniciar atendimento"** → cria/recupera appointment e navega para `/atendimento/:id`.

## Arquivos afetados (apenas presentation/UI)
- `src/components/agenda/AppointmentDetailDialog.tsx` — renomear botão + ícone.
- `src/components/AppSidebar.tsx` — novo item + abrir picker.
- `src/components/CommandPalette.tsx` (existente) — ação "Abrir prontuário".
- `src/components/patients/PatientPickerDialog.tsx` — **novo** componente de busca/seleção.
- `src/components/waiting-room/WaitingRoomCard.tsx` — relabel.
- `src/components/patients-of-day/DayAppointmentRow.tsx` — adicionar botão Prontuário.
- `src/pages/Patients.tsx` — coluna de ação visível.
- `src/pages/Attendance.tsx` — link "Ver prontuário completo" no header.
- `src/pages/dentist/DentistHome.tsx` — botão Prontuário nos cards.
- `src/pages/PatientDetail.tsx` — garantir aba "Resumo" como default + botão "Iniciar atendimento".

## Fora de escopo
- Nenhuma mudança em backend, RLS, ou lógica de negócio.
- Nenhuma alteração no fluxo de gravação por IA já implementado.
- Sem nova rota — reutilizamos `/patients/:id`.
