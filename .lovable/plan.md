## Mudanças solicitadas

### 1. Remover coluna "Em Negociação" do Kanban de Orçamentos
**Arquivo:** `src/pages/Budgets.tsx`
- Remover o objeto `{ id: 'negotiating', label: 'Em Negociação', bar: 'bg-blue-400' }` do array `COLUMNS`.
- O Kanban passará a ter 3 colunas: Pendente, Aprovado, Perdido.
- Orçamentos já existentes com status `negotiating` (se houver) cairão no fallback `pending` na função `columnData`. Não vamos alterar dados no banco — apenas a UI deixa de exibir a coluna.

### 2. Cancelamento de consulta libera o horário
**Arquivos a inspecionar/editar:**
- `src/components/agenda/AppointmentDetailDialog.tsx` (ação cancelar pelo médico/secretária)
- `src/lib/appointmentConflicts.ts` (lógica de conflito de horário)
- `src/pages/Agenda.tsx` (renderização do slot)

**Comportamento atual:** Hoje uma appointment cancelada continua ocupando o slot visualmente e a verificação de conflito pode considerá-la.

**Mudança:**
- Garantir que `appointmentConflicts` ignore registros com `status IN ('cancelled', 'no_show')`.
- Na grade da Agenda, ocultar (ou estilizar como livre) appointments cancelados, de forma que o slot apareça disponível para nova marcação.
- O registro continua no banco para histórico — apenas não bloqueia nem ocupa visualmente o horário.

### 3. Remover passo de pagamento ao finalizar consulta (médico)
**Arquivos a inspecionar/editar:**
- `src/components/attendance/ConsultationPaymentDialog.tsx` — deixará de ser aberto no fluxo do médico
- `src/pages/Attendance.tsx` (ou componente equivalente em `src/components/attendance/`) que dispara o dialog ao finalizar

**Mudança:**
- Ao finalizar a consulta, NÃO abrir `ConsultationPaymentDialog`. A consulta vai para "encerrada" diretamente e a `financial_transaction` permanece com `status = 'pending'` (sem `payment_method`/`paid_date`).
- O componente `ConsultationPaymentDialog` continua existindo para ser usado pela secretária na Sala de Espera / fluxo do paciente presencial.

### 4. Secretária gerencia pagamento na chegada do paciente
**Arquivos a inspecionar/editar:**
- `src/pages/WaitingRoom.tsx` e `src/components/waiting-room/WaitingRoomCard.tsx`
- Possivelmente `src/pages/PatientsOfDay.tsx` / `src/components/patients-of-day/DayAppointmentRow.tsx`

**Mudança:**
- Adicionar ação "Registrar pagamento" no card do paciente em espera (visível apenas para `admin` / `secretary`, conforme `useRoleAccess`), que abre o `ConsultationPaymentDialog` já existente com a `financial_transaction` pendente daquela consulta.
- Se a transação ainda não existir (consulta não finalizada), criar o registro `pending` no momento ou usar o orçamento/valor da consulta como base — definir na implementação após ler os arquivos.

## Pontos a confirmar antes de implementar
1. Na Agenda, quando o horário é cancelado, prefere **ocultar** completamente o card cancelado do grid (slot vira "vazio") ou **mostrar** discreto/riscado com badge "Cancelado" mas permitir clicar e criar uma nova consulta por cima?
2. A ação "Registrar pagamento" da secretária deve aparecer (a) no card da Sala de Espera quando o paciente chega, (b) na linha de Pacientes do Dia, ou (c) em ambos?
