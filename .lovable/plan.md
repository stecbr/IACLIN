

# Plano: Fluxo completo de aprovação e atendimento da consulta

## Visão geral

Mudar o fluxo do agendamento de **direto** para **com aprovação**, ligando paciente → clínica → médico → atendimento. Hoje o paciente clica "Confirmar" e tenta gravar direto em `patients`/`appointments` (RLS bloqueia). Vamos transformar isso num pedido que entra numa fila de aprovação da clínica.

## Fluxo novo

```text
Paciente clica Confirmar
        ↓
[appointment_requests] status=pending  (criado via edge function segura)
        ↓
Clínica vê na aba "Aprovações" + sino de notificação
        ↓
Admin aprova → cria appointment status=scheduled
        ↓
Médico recebe sino "Nova consulta confirmada"
Paciente recebe sino "Sua consulta foi confirmada"
        ↓
Médico vê detalhes, pode confirmar/reagendar
        ↓
Quando faltar ≤30min → botão "Iniciar atendimento" aparece
        ↓
Vai pra /atendimento/:id (tela clínica que já existe)
```

## Mudanças no banco

### Nova tabela `appointment_requests`
- `id`, `patient_user_id`, `patient_account_snapshot` (jsonb com nome/cpf/phone)
- `clinic_id`, `dentist_id`, `specialty`, `start_time`, `end_time`
- `notes`, `status` (`pending` | `approved` | `rejected` | `cancelled`)
- `created_at`, `decided_at`, `decided_by`, `rejection_reason`
- `appointment_id` (preenchido quando aprovada)

### RLS
- Paciente: vê e cria os próprios pedidos.
- Membros da clínica: veem e atualizam pedidos da sua clínica.
- Médico: vê pedidos onde `dentist_id = auth.uid()`.

### Triggers de notificação
- `INSERT` em `appointment_requests` → notifica todos admins da clínica (sino).
- `UPDATE` para `approved` → notifica médico + paciente.
- `UPDATE` para `rejected` → notifica paciente com motivo.

## Edge functions

### `request-appointment` (nova)
Substitui o insert direto que dá erro de RLS:
- Valida usuário autenticado e `patient_accounts`.
- Valida slot ainda livre (sem outro `pending`/`approved` no mesmo horário).
- Cria registro em `appointment_requests` com snapshot dos dados do paciente.
- Retorna mensagem clara em caso de erro.

### `approve-appointment-request` (nova)
- Só admin/owner da clínica pode chamar.
- Verifica se ainda está `pending`.
- Encontra/cria `patients` na clínica (linka por CPF, cria se não existir).
- Cria `appointments` com `status=scheduled`.
- Atualiza request: `status=approved`, `appointment_id`, `decided_at/by`.

### `reject-appointment-request` (nova)
- Mesma autorização.
- Atualiza status + `rejection_reason`.

## Mudanças no frontend

### Paciente

**`src/pages/patient/PatientBooking.tsx`**
- `handleConfirm` chama `request-appointment` (não insere mais direto).
- Toast: "Pedido enviado! A clínica vai confirmar em breve."
- Redireciona pra `/paciente/agendas` que mostrará o pedido pendente.

**`src/pages/patient/PatientAppointments.tsx`**
- Adicionar seção "Pedidos pendentes" no topo, listando `appointment_requests` com status `pending`/`rejected`.
- Badge amarelo "Aguardando confirmação" / vermelho "Recusado".
- Botão "Cancelar pedido" enquanto pendente.

**`src/components/marketplace/BookingConfirmation.tsx`**
- Mesma troca: chama `request-appointment`.

### Clínica (admin)

**Nova página `src/pages/clinica/ClinicaAprovacoes.tsx`** (`/clinica/aprovacoes`)
- Lista de cards com pedidos `pending`: paciente, médico, especialidade, data/hora, observações.
- Botões: **Aprovar** (verde) | **Reagendar** (abre dialog com sugestão de novo horário) | **Recusar** (pede motivo).
- Tabs: Pendentes | Aprovadas | Recusadas (histórico).
- Real-time via Supabase Realtime → atualiza a lista quando chega novo pedido.

**`src/components/AppSidebar.tsx`**
- Novo item "Aprovações" com badge de contagem de pendentes (só pra admin).

**`src/components/NotificationBell.tsx`**
- Já funciona — só garantir que `type=appointment_request` abra `/clinica/aprovacoes`.

### Médico

**`src/pages/dentist/DentistHome.tsx`**
- Card "Próximas consultas" mostra agendamentos aprovados com indicador "Confirmada pela clínica".
- Quando faltar ≤30min pra `start_time`: botão verde **"Iniciar atendimento"** que leva pra `/atendimento/:appointmentId`.

**`src/pages/Agenda.tsx`** (visão do médico)
- No `AppointmentDetailDialog`, se faltarem ≤30min: botão destacado "Iniciar atendimento agora".
- Adicionar botão "Reagendar" e "Confirmar presença" pro médico.

**`src/components/agenda/AppointmentDetailDialog.tsx`**
- Mostrar origem: "Agendado pelo paciente via app" quando vier de `appointment_requests`.

### Tela de atendimento (já existe)
- `/atendimento/:appointmentId` (`Attendance.tsx`) já tem todos os blocos clínicos que criamos antes (anamnese, vital signs, hipóteses, solicitações, etc.). Só precisa estar acessível via o botão novo. Sem mudanças nela.

## Notificações (sino)

| Evento | Quem recebe | Mensagem |
|---|---|---|
| Pedido criado | Admins da clínica | "Novo pedido de consulta de {paciente}" |
| Pedido aprovado | Médico | "Nova consulta confirmada: {paciente} em {data}" |
| Pedido aprovado | Paciente | "Sua consulta em {clínica} foi confirmada" |
| Pedido recusado | Paciente | "Sua consulta foi recusada: {motivo}" |
| Reagendamento | Paciente + Médico | "Consulta reagendada para {nova data}" |

## Botão "Iniciar atendimento" — regra

Aparece quando:
- `appointment.status = 'scheduled'` ou `'confirmed'`
- `now() >= start_time - 30min` E `now() <= end_time + 60min`
- Usuário logado é o `dentist_id` do appointment

## Arquivos tocados

**Novos**
- `supabase/functions/request-appointment/index.ts`
- `supabase/functions/approve-appointment-request/index.ts`
- `supabase/functions/reject-appointment-request/index.ts`
- `src/pages/clinica/ClinicaAprovacoes.tsx`
- `src/components/clinica/ApprovalCard.tsx`
- `src/components/clinica/RescheduleDialog.tsx`

**Editados**
- `src/pages/patient/PatientBooking.tsx`
- `src/pages/patient/PatientAppointments.tsx`
- `src/components/marketplace/BookingConfirmation.tsx`
- `src/components/AppSidebar.tsx`
- `src/pages/dentist/DentistHome.tsx`
- `src/pages/Agenda.tsx`
- `src/components/agenda/AppointmentDetailDialog.tsx`
- `src/App.tsx` (rota nova)

**Migrations**
- Cria `appointment_requests` + RLS + triggers de notificação.
- Habilita realtime na tabela.

## O que NÃO muda

- Tela `/atendimento/:id` continua igual (já tem os blocos clínicos).
- Agenda interna da clínica (criada pela secretária) continua direto, sem aprovação — só o fluxo do paciente passa pela aprovação.
- RLS de `patients`/`appointments` permanece restrita.

## Resultado final

Você logará como Flávio → pedirá consulta com Joel → o pedido entra na fila da clínica do Lucas → Lucas (admin) aprova → Joel recebe sino + vê na agenda → quando chegar perto da hora, Joel clica "Iniciar atendimento" → preenche os blocos clínicos.

