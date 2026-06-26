## Causa raiz (verificada)

O CHECK constraint **já está correto** no banco e aceita `awaiting_payment` (verificado via `pg_constraint`). O problema real é o **trigger** `sync_appointment_presence_status` (função em `public`):

```sql
IF NEW.status = 'completed' AND NEW.presence_status <> 'finished' THEN
  NEW.presence_status := 'finished';
```

Quando o `Attendance.tsx` faz `update({ status: 'completed', presence_status: 'awaiting_payment' })`, o trigger **sobrescreve** `presence_status` para `'finished'` antes de gravar. Resultado: o card cai na lista de "finalizados" e some das colunas ativas — exatamente o sintoma reportado.

A query da Sala de Espera já contempla `awaiting_payment` (coluna existe, filtro `not in (cancelled)` não exclui), então não é problema de UI.

## Correção

### 1. Migration — ajustar o trigger para respeitar `awaiting_payment`

```sql
CREATE OR REPLACE FUNCTION public.sync_appointment_presence_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed'
       AND NEW.presence_status NOT IN ('finished','awaiting_payment') THEN
      NEW.presence_status := 'finished';
    ELSIF NEW.status = 'no_show' AND NEW.presence_status <> 'no_show' THEN
      NEW.presence_status := 'no_show';
    ELSIF NEW.status = 'cancelled' AND NEW.presence_status = 'in_service' THEN
      NEW.presence_status := 'finished';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.presence_status IS DISTINCT FROM NEW.presence_status THEN
    IF NEW.presence_status = 'arrived' AND NEW.arrived_at IS NULL THEN
      NEW.arrived_at := now();
    ELSIF NEW.presence_status = 'in_service' AND NEW.service_started_at IS NULL THEN
      NEW.service_started_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;
```

Sem mudanças em RLS/grants (não estamos criando tabela).

### 2. Reforço em `src/pages/Attendance.tsx` (handleFinish, ~linha 666)

Log e mensagem real do erro para não falhar silencioso no futuro:

```ts
if (aptError) {
  console.error('Erro ao finalizar consulta:', aptError);
  toast.error('Erro ao finalizar: ' + aptError.message);
  throw aptError;
}
```

### 3. Verificação manual após deploy

- Médico finaliza em `/atendimento/:id` → na Sala de Espera o card aparece em **Aguardando pagamento**.
- Secretário/admin vê **Registrar pagamento** / **Cobrar depois** na coluna; dentista comum não vê.

Não é necessário alterar `WaitingRoom.tsx` nem `WaitingRoomCard.tsx` — a coluna e a lógica de permissão já estão corretas; o bug era exclusivamente do trigger sobrescrevendo o status.
