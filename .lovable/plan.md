## Objetivo

Quando o paciente tentar agendar um horário que conflita com outra consulta/pedido dele mesmo (mesmo médico ou outro), em vez de bloquear, mostrar um **diálogo de confirmação**:

> "Você já tem uma consulta com Dr(a). Joel às 08:30. Se continuar, esse agendamento será cancelado e substituído pelo novo horário (10:00). Deseja continuar?"

Se confirmar → o agendamento antigo é cancelado e o novo é criado. Se não → mantém tudo como está.

## Comportamento

1. Paciente seleciona horário e clica em "Confirmar".
2. Frontend chama `request-appointment` normalmente.
3. Edge function detecta conflito do **próprio paciente** e, em vez de retornar erro 409 genérico, retorna `409` com payload estruturado:
   ```json
   {
     "conflict": true,
     "type": "patient_overlap" | "patient_same_doctor",
     "message": "Você já tem consulta com Dr(a). Joel às 08:30.",
     "existing": { "kind": "appointment" | "request", "id": "...", "dentistName": "Joel", "startTime": "...", "endTime": "..." }
   }
   ```
4. Frontend abre `AlertDialog`:
   - Título: "Você já tem uma consulta nesse dia"
   - Descrição: "Sua consulta com Dr(a). {nome} das {HH:mm} às {HH:mm} será **cancelada** e substituída por este novo horário ({nova HH:mm}). Deseja continuar?"
   - Botões: "Cancelar" / "Sim, reagendar"
5. Ao confirmar, chama `request-appointment` novamente passando `replaceExistingId` e `replaceKind` ('appointment' ou 'request').
6. Edge function, com `replaceExistingId` válido (e pertencente ao mesmo `patient_user_id`):
   - `appointment` → `UPDATE appointments SET status='cancelled'`
   - `request` → `UPDATE appointment_requests SET status='cancelled'`
   - Em seguida cria o novo `appointment_request` normalmente.
7. Conflitos com **horário do médico** (não do paciente) continuam sendo bloqueio puro (409), pois o paciente não tem autoridade para cancelar agenda de outro paciente.

## Arquivos afetados

**`supabase/functions/request-appointment/index.ts`**
- Reestruturar respostas de conflito do paciente para retornar `{ conflict: true, type, message, existing }`.
- Aceitar campos opcionais `replaceExistingId` e `replaceKind` no body.
- Quando recebidos: validar ownership (o registro pertence ao `userId`), cancelar o registro antigo (UPDATE status='cancelled'), e prosseguir com a checagem dos demais conflitos (médico, etc.) e a inserção.
- Conflitos do médico permanecem como erro bloqueante.

**`src/pages/patient/PatientBooking.tsx`**
- No `handleConfirm`, ao receber resposta com `conflict: true`, abrir um `AlertDialog` (estado `confirmReplace`) com a mensagem montada a partir de `existing`.
- Ao confirmar, reinvocar `request-appointment` com `replaceExistingId` + `replaceKind`.
- Mostrar toast de sucesso adaptado ("Sua consulta foi reagendada").

**`src/components/agenda/AppointmentFormDialog.tsx`** (admin/manual booking)
- Mesma lógica de confirmação: quando `checkAppointmentConflicts` detectar overlap **do próprio paciente**, abrir um `AlertDialog` perguntando se deseja substituir; se sim, cancelar o antigo e criar o novo.
- Conflitos do dentista continuam bloqueantes.

**`src/lib/appointmentConflicts.ts`**
- Estender `ConflictResult` para incluir `type` e `existing` (id, dentistId, dentistName, startTime, endTime, kind) quando o conflito for do paciente — para que a UI possa montar o diálogo.

## Detalhes técnicos

- A edge function lê `Authorization` e usa o cliente `supabaseUser` para garantir que o registro a cancelar pertence ao paciente (consulta com filtro `patient_user_id = userId` ou via `patients.patient_user_id`). Assim respeitamos RLS de "Patients can cancel own pending requests" e a policy de update de appointments do paciente.
- O fluxo segue idempotente: se o `replaceExistingId` não existir mais ou já estiver cancelado, apenas ignora e prossegue.
- Mensagens em pt-BR, formato `HH:mm` com `date-fns`/manual a partir de ISO.
- Sem mudanças de schema — todo o trabalho é em código.

## Não incluso

- Não altera a regra de "mesmo médico no mesmo dia" (já removida; agora vale sobreposição).
- Não mexe em notificações; o trigger existente já notifica cancelamentos.