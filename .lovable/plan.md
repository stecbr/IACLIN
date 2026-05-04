## Problema

Quando uma consulta é cancelada (pelo paciente, secretaria ou médico), o horário **deveria voltar a ficar livre**, mas continua bloqueado em alguns casos.

### Diagnóstico

A grade de horários em `ClinicDoctorStep.tsx` calcula slots ocupados juntando duas fontes:

1. `appointments` com `status != 'cancelled'` ✅ (cancelamento libera o slot)
2. `appointment_requests` com `status IN ('pending','approved')` ⚠️

**A falha está no caso 2**: quando um pedido é **aprovado**, ele gera uma `appointment` (status `scheduled`) e o `appointment_request` permanece com status `approved` apontando para ela (`appointment_id`).

Se depois alguém cancela a consulta:
- `appointments.status` vira `cancelled` ✅
- mas `appointment_requests.status` continua `approved` ❌

Resultado: o slot permanece marcado como ocupado pelo `appointment_request` aprovado, mesmo a consulta tendo sido cancelada. O mesmo acontece quando o paciente cancela seu próprio pedido aprovado pelo `PatientAppointments` — só o `appointment_requests` é atualizado, não a `appointments` (e vice-versa).

Há também um detalhe: a query da grade não filtra por `end_time > dayStart`, mas isso não afeta o caso atual (todos slots são pelo `start_time` do dia).

## Solução

### 1. Trigger no banco para sincronizar cancelamentos (raiz do problema)

Criar um trigger em `appointments` que, ao mudar status para `cancelled`, atualiza o `appointment_requests` vinculado para `cancelled` também. E vice-versa: ao cancelar um `appointment_request` aprovado, cancelar a `appointment` correspondente.

```sql
-- Quando a appointment é cancelada, cancela o request vinculado
CREATE FUNCTION sync_request_on_appointment_cancel() ...
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE appointment_requests
      SET status = 'cancelled'
      WHERE appointment_id = NEW.id
        AND status IN ('pending','approved');
  END IF;

-- Quando o request aprovado é cancelado, cancela a appointment
CREATE FUNCTION sync_appointment_on_request_cancel() ...
  IF NEW.status = 'cancelled' AND OLD.status = 'approved' AND NEW.appointment_id IS NOT NULL THEN
    UPDATE appointments
      SET status = 'cancelled'
      WHERE id = NEW.appointment_id AND status <> 'cancelled';
  END IF;
```

Isso garante que **qualquer caminho de cancelamento** (paciente em `PatientAppointments`, secretaria/médico em `AppointmentDetailDialog`, edge function `request-appointment` ao substituir, ou edge function de rejeição) libere o slot consistentemente.

### 2. Endurecer a grade do paciente

Em `src/components/patient/booking/ClinicDoctorStep.tsx`, na query de `appointment_requests`, manter o filtro `IN ('pending','approved')` (já está correto) — após o trigger, requests vinculados a appointments canceladas estarão com status `cancelled` e serão automaticamente excluídos.

### 3. Validação

Após aplicar:
- Cancelar uma consulta agendada na agenda da clínica → o slot some da grade pública.
- Paciente cancelar seu pedido em "Minhas consultas" → consulta aprovada também é cancelada e libera o slot.
- Reagendamento via fluxo de "Substituir" continua funcionando (já cancela o registro antigo manualmente, e o trigger é idempotente).

## Arquivos afetados

- **Migração SQL nova**: criar 2 triggers (`appointments` AFTER UPDATE, `appointment_requests` AFTER UPDATE).
- Nenhuma alteração necessária no front, edge functions, ou RLS — a lógica de cancelamento existente passa a ser "completa" automaticamente.
