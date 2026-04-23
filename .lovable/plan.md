

# Plano: Check-in / Sala de Espera Digital

## Conceito

Adicionar um **status de presença** no agendamento (separado do status clínico) que a recepção atualiza ao longo do dia. O médico vê na agenda, em tempo real, quem já chegou e está esperando.

```text
Status clínico (já existe):  scheduled → confirmed → completed → cancelled
Status presença (novo):      not_arrived → arrived → in_service → finished
```

Os dois andam juntos: uma consulta `confirmed` pode estar `arrived` (paciente na recepção) ou `in_service` (já entrou no consultório).

## Como vai funcionar (fluxo do dia)

1. **Paciente chega na clínica** → recepção abre o painel "Sala de Espera" → clica em "Marcar chegada" no card do paciente.
2. Card vira amarelo, aparece um cronômetro: "Esperando há 5 min".
3. **Médico vê na agenda**: o slot do paciente ganha um badge verde "Chegou" + tempo de espera.
4. Médico chama o paciente → clica "Iniciar atendimento" (já existe o botão de iniciar consulta) → status presença vira `in_service`.
5. Ao finalizar a consulta → vira `finished` automaticamente.

## Mudanças no banco

**Migração**: adicionar coluna `presence_status` em `appointments`:
- Valores: `not_arrived` (default) | `arrived` | `in_service` | `finished` | `no_show`
- Coluna extra `arrived_at` (timestamp) para calcular tempo de espera.
- Coluna extra `service_started_at` (timestamp) para histórico/métricas.

Atualização automática:
- Quando `status` muda para `completed` → `presence_status = 'finished'`.
- Quando atendimento é iniciado (`Attendance.tsx` cria `clinical_record`) → `presence_status = 'in_service'` e `service_started_at = now()`.

## Telas e componentes novos

### 1. Nova página: `/sala-de-espera` (`src/pages/WaitingRoom.tsx`)

Painel dedicado para a recepção, com 3 colunas tipo Kanban:

```text
┌─────────────────┬─────────────────┬─────────────────┐
│  AGUARDADOS     │  NA RECEPÇÃO    │  EM ATENDIMENTO │
│  (hoje)         │  (já chegaram)  │                 │
├─────────────────┼─────────────────┼─────────────────┤
│ 09:00 Maria S.  │ ⏱ 12 min        │ ⏱ 5 min         │
│ Dr. João        │ Carlos P.       │ Ana L.          │
│ [Marcar chegada]│ Dr. João        │ Dr. Pedro       │
├─────────────────┼─────────────────┤                 │
│ 09:30 José R.   │ ⏱ 3 min         │                 │
│ Dr. Pedro       │ Lucia M.        │                 │
│ [Marcar chegada]│ Dr. Pedro       │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

- Lista todas as consultas do **dia atual**.
- Filtro por médico (dropdown opcional).
- Atualização em tempo real via Supabase Realtime (já usado no projeto).
- Botões grandes, otimizado para tablet/touchscreen na recepção.
- Acesso: **admin + secretary** (recepção).

### 2. Badge na agenda (`src/pages/Agenda.tsx` + `AppointmentDetailDialog.tsx`)

No card de cada agendamento da agenda do médico, adicionar um indicador visual quando `presence_status = 'arrived'`:
- Pequeno ponto verde + texto "Aguardando há 12 min" no canto do card.
- Cor diferente da borda do card.
- Tooltip com horário exato da chegada.

### 3. Item no menu lateral

Adicionar **"Sala de Espera"** no `AppSidebar` (ícone `Users` ou `ClipboardCheck`), visível só para `admin` e `secretary`. Atualizar `useRoleAccess.ts` com a nova rota.

### 4. Mobile bottom nav

Adicionar atalho para a sala de espera no `MobileBottomNav` para a recepção.

## Componente: `WaitingRoomCard.tsx`

Card individual de cada paciente com:
- Nome, foto/avatar
- Médico, especialidade
- Horário marcado vs hora atual (atrasado? adiantado?)
- Cronômetro vivo de espera (atualiza a cada 30s)
- Botões de ação contextual: `[Chegou]` → `[Iniciar atendimento]` → `[Finalizar]`
- Botão `[Marcar falta]` (vira `no_show`)

## Realtime

Subscription na tabela `appointments` filtrada por `clinic_id` + `start_time` do dia atual:
- Quando recepção muda `presence_status`, médico vê na agenda dele em ~1s.
- Quando médico inicia atendimento, recepção vê o paciente sair da coluna "Recepção" e ir para "Em atendimento".

## Métricas (bônus, opcional)

Como `arrived_at` e `service_started_at` ficam salvos, dá para mostrar no dashboard:
- Tempo médio de espera no mês.
- Pacientes que esperaram mais de 30 min (alerta de qualidade).

## Arquivos criados/editados

**Novos:**
- `src/pages/WaitingRoom.tsx`
- `src/components/waiting-room/WaitingRoomCard.tsx`
- `src/components/waiting-room/WaitingTimer.tsx` (cronômetro vivo)
- Migração SQL: adicionar `presence_status`, `arrived_at`, `service_started_at` em `appointments`.

**Editados:**
- `src/App.tsx` — registrar rota `/sala-de-espera`.
- `src/components/AppSidebar.tsx` — novo item de menu.
- `src/components/MobileBottomNav.tsx` — atalho mobile (recepção).
- `src/hooks/useRoleAccess.ts` — permissão `admin`/`secretary`.
- `src/pages/Agenda.tsx` + `src/components/agenda/AppointmentDetailDialog.tsx` — badge de chegada e tempo de espera.
- `src/pages/Attendance.tsx` — ao iniciar atendimento, atualizar `presence_status = 'in_service'`.

## Fora do escopo (deixar para depois)

- Chamada por número/painel de TV na sala de espera (estilo banco).
- Notificação WhatsApp automática "É a sua vez".
- Estimativa de tempo de espera para o paciente.

## Resultado esperado

- **Recepção** abre `/sala-de-espera` no tablet, vê todos do dia, marca chegadas.
- **Médico** vê na agenda quem já está esperando, sem precisar perguntar para a recepção.
- **Paciente** é atendido mais rápido, sem esquecimento.
- Tudo em tempo real, sincronizado entre todos os dispositivos da clínica.

