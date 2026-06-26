## Causa raiz

A coluna `appointments.presence_status` tem um `CHECK` no banco que só permite `not_arrived | arrived | in_service | finished | no_show` — **não** inclui `awaiting_payment`.

Quando o médico finaliza pelo `Attendance.tsx`, o `UPDATE` tenta gravar `presence_status = 'awaiting_payment'` e o banco rejeita pelo check. O `clinical_records.status` é atualizado antes (sucesso), mas o `appointments` falha — então o card "some" da coluna *Em atendimento* (presence ficou em `in_service` mas a query invalida e re-renderiza com erro) e nunca chega em *Aguardando pagamento*.

O mesmo motivo afeta a Sala de Espera quando o secretário clica em **Concluir atendimento** no card de *Em atendimento* (que chama `updatePresence(id, 'awaiting_payment')`) — a UI mostra toast de erro e o card volta/some.

## Correção

### 1. Migration SQL — liberar `awaiting_payment` no CHECK

```sql
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_presence_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_presence_status_check
  CHECK (presence_status = ANY (ARRAY[
    'not_arrived'::text,
    'arrived'::text,
    'in_service'::text,
    'awaiting_payment'::text,
    'finished'::text,
    'no_show'::text
  ]));
```

Sem mudanças em RLS/grants (não estamos criando tabela).

### 2. Pequeno reforço no `Attendance.tsx`

Após o `UPDATE` bem-sucedido, invalidar também a query da Sala de Espera para refletir imediatamente em outras abas/usuários (o realtime já cobre, mas garante UX):

```ts
queryClient.invalidateQueries({ queryKey: ['appointments'] });
queryClient.invalidateQueries({ queryKey: ['waiting-room'] });
```

### 3. Verificação

- Médico finaliza em `/atendimento/:id` → card sai de *Em atendimento* e aparece em *Aguardando pagamento* na Sala de Espera para secretário/admin.
- Botão "Registrar pagamento" abre o `FinishPaymentDialog`; "Cobrar depois" mantém na coluna.

Nenhuma mudança em componentes da Sala de Espera é necessária — a coluna e KPI já existem desde a iteração anterior; era só o CHECK do banco bloqueando o status novo.