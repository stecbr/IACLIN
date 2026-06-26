## Problema

Quando o paciente já realizou uma consulta com o médico no mesmo dia e tenta marcar outra, ainda aparece o modal antigo "Você já tem consulta com este profissional… será cancelada e substituída" em vez do modal de "Marcar retorno para hoje?".

Causa raiz, em `supabase/functions/request-appointment/index.ts`:

1. A query `sameDoctorSameDayApptQ` retorna até 1 linha sem `order by`. Se o paciente tem **duas** consultas no mesmo dia com o mesmo médico (ex.: a concluída das 09:30 e um pedido/consulta ativa anterior), o Postgres pode retornar a ativa primeiro, então o código entra no ramo `patient_overlap_appointment` e mostra o modal de cancelar/substituir.
2. A query `sameDoctorSameDayReqQ` (appointment_requests pendentes/aprovados) é avaliada antes de qualquer ramo de "completed". Se sobrou um `appointment_request` pendente de uma tentativa anterior do mesmo dia, ele dispara `patient_overlap_request` e o modal antigo aparece — nunca dá chance de detectar a consulta concluída.
3. O front (`PatientBooking.tsx`) só trata `patient_completed_same_day` no `AlertDialog`, então qualquer outro `type` cai no texto antigo.

## Mudanças

### 1. `supabase/functions/request-appointment/index.ts`

- Em `sameDoctorSameDayApptQ`: ordenar por `status` priorizando `completed` (ex.: `order('status', { ascending: false })` não resolve genericamente — usar `order('start_time', { ascending: true })` e, no JS, **preferir** a linha com `status='completed'` dentre todas as do dia). Trocar `.limit(1)` por buscar todas as do dia (sem limit) e escolher: se existir alguma `completed`, usar essa; senão, usar a primeira ativa.
- Avaliar o ramo "completed same day" **antes** de `sameDocDayReq`, para que a presença de um request pendente não suprima o modal de retorno. Ou seja, reordenar para:
  1. Se há appointment `completed` mesmo dia mesmo médico → `patient_completed_same_day` (respeitando `allowCompletedSameDay`).
  2. Se há appointment ativo mesmo dia mesmo médico → `patient_overlap_appointment`.
  3. Se há request pendente mesmo dia mesmo médico → `patient_overlap_request`.
  4. Demais checks (overlap de horário do médico, overlap do paciente) seguem como hoje.
- Quando `allowCompletedSameDay = true`, pular também a checagem de `sameDocDayReq` apenas se o request pendente for da própria tentativa anterior do paciente (mantém segurança contra duplo agendamento, mas não bloqueia o retorno).

### 2. `src/pages/patient/PatientBooking.tsx`

Sem mudança estrutural — já trata `patient_completed_same_day` com o modal "Marcar retorno para hoje?". Apenas validar visualmente que o fluxo agora dispara o modal correto.

## Notas técnicas

- Nenhuma migração de banco.
- Sem mudança de RLS/GRANTs.
- Sem mudança no `FinishPaymentDialog` nem em outros componentes.
- Edge function `request-appointment` precisa ser redeployada após a edição.
