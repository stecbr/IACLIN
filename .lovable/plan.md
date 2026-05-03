# Validação de Conflitos de Agendamento

## Regras (revisadas)

1. **Paciente** pode ter várias consultas no mesmo dia, **desde que**:
   - não tenha outra consulta com o **mesmo médico** no mesmo dia, e
   - não tenha outra consulta em **horário sobreposto** (com qualquer médico).
2. **Médico** não pode ter outro atendimento sobreposto no mesmo horário.
3. Mensagens de erro devem mencionar o **nome do médico** envolvido.

Aplicar nos dois fluxos:
- Equipe da clínica → `src/components/agenda/AppointmentFormDialog.tsx`
- Paciente (auto-agendamento) → `supabase/functions/request-appointment/index.ts`

---

## 1. AppointmentFormDialog (clínica)

Antes do `INSERT`, rodar 3 checagens (em `appointments`, status ≠ cancelled, sobre o intervalo `[startDt, endDt)`):

**a) Mesmo médico + mesmo paciente no mesmo dia**
- Filtrar `patient_id = X`, `dentist_id = user.id`, `start_time` entre início e fim do dia.
- Se houver: toast `"Este paciente já tem consulta com Dr(a). {nome} neste dia."`

**b) Sobreposição de horário do paciente (qualquer médico)**
- Filtrar `patient_id = X`, `start_time < endDt`, `end_time > startDt`.
- Se houver: toast `"O paciente já tem consulta com Dr(a). {nome} das {HH:mm} às {HH:mm}."`

**c) Sobreposição de horário do médico**
- Filtrar `dentist_id = user.id`, `start_time < endDt`, `end_time > startDt`.
- Se houver: toast `"Você já tem atendimento marcado das {HH:mm} às {HH:mm}."`

Resolver nome do médico via `profiles.full_name` (lookup por `dentist_id`).

Aplicar a mesma validação ao **agendamento de retorno** (returnDays).

---

## 2. Edge function `request-appointment` (paciente)

Substituir a checagem atual (igualdade de `start_time`) por sobreposição e adicionar bloqueio por mesmo médico no mesmo dia.

Usando `admin` client:

**a) Sobreposição em `appointments` do dentista** → 409 `"Este horário não está mais disponível com Dr(a). {nome}."`

**b) Sobreposição em `appointment_requests` (status pending|approved) do dentista** → 409 `"Já existe um pedido para um horário em conflito com Dr(a). {nome}."`

**c) Mesmo médico + mesmo paciente no mesmo dia**
- Buscar registro de `patients` do usuário (`patient_user_id = userId`) para obter `patient_id`s, então:
  - `appointments`: `patient_id IN (...)`, `dentist_id = X`, dia = D, status ≠ cancelled.
  - `appointment_requests`: `patient_user_id = userId`, `dentist_id = X`, dia = D, status IN (pending, approved).
- Se houver: 409 `"Você já tem consulta agendada com Dr(a). {nome} neste dia."`

**d) Sobreposição de horário do paciente com qualquer médico**
- `appointments` do paciente no intervalo + `appointment_requests` (pending|approved) do paciente no intervalo.
- Se houver: 409 `"Você já tem consulta com Dr(a). {nome} das {HH:mm} às {HH:mm}."`

Nome do dentista via `profiles.full_name`.

---

## Detalhes técnicos

- Criar `src/lib/appointmentConflicts.ts` com helper `checkAppointmentConflicts({ supabase, patientId, dentistId, startTime, endTime })` retornando `{ ok, message? }`. Reutilizado no dialog (consulta principal e retorno).
- Mensagens via `toast.error` (sonner).
- Sem migrations nem mudanças de schema/UI.
- Datas: usar limites de dia em horário local (já há helpers `startOfDay`/`endOfDay`).

## Arquivos modificados

- `src/lib/appointmentConflicts.ts` (novo)
- `src/components/agenda/AppointmentFormDialog.tsx` (validação no submit + retorno)
- `supabase/functions/request-appointment/index.ts` (substituir checagens e adicionar regras)
