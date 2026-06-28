## Bloco A — Seat Limit (Limite de Profissionais por Clínica)

### 1. Banco de Dados (migração)

Criar duas funções `SECURITY DEFINER`:

**`public.get_clinic_seat_usage(_clinic_id uuid) RETURNS jsonb`**
- Conta membros ativos com `role IN ('admin','dentist')` em `clinic_members` (apenas os que ocupam assento profissional; `secretary` e `auxiliary` ficam fora).
- Busca `max_professionals` do plano vigente via `platform_subscriptions` (entity_type='clinic', entity_id=_clinic_id, status IN ('active','trial')) → join em `platform_plans`.
- Retorna `{ used, limit, available, has_subscription, status }`. Quando `max_professionals` é NULL = ilimitado (`available = 9999`).
- Permissão: qualquer membro da clínica pode chamar (`user_belongs_to_clinic`).

**`public.check_clinic_seat_available(_clinic_id uuid) RETURNS boolean`**
- Wrapper que retorna `used < limit` (ou `true` se ilimitado). Usado pela edge function.

Grants: `EXECUTE ... TO authenticated, service_role`.

### 2. Edge Function `invite-member`

Antes do bloco que cria o usuário (após validar `ownerCheck`, mas só quando `role === 'dentist'`):

```ts
if (role === 'dentist') {
  const { data: usage } = await adminClient.rpc('get_clinic_seat_usage', { _clinic_id: clinic_id });
  if (usage && !usage.unlimited && usage.used >= usage.limit) {
    return jsonResponse({
      ok: false,
      code: 'seat_limit_reached',
      error: `Limite do plano atingido (${usage.used}/${usage.limit} profissionais). Faça upgrade para adicionar mais.`,
      usage,
    }, 403);
  }
}
```

`secretary` e `auxiliary` não consomem assento e continuam permitidos.

### 3. Frontend

**Novo hook `src/hooks/useSeatUsage.ts`**
- Recebe `clinicId`, faz `supabase.rpc('get_clinic_seat_usage', { _clinic_id })`.
- Retorna `{ used, limit, available, unlimited, isLoading, refetch }`.
- Invalidação: expõe `refetch` para chamar após convite criado/membro removido.

**`src/components/settings/TeamSection.tsx`**
- Importa `useSeatUsage` e mostra badge no header da seção: `"3 de 5 profissionais"` (ou `"3 profissionais (ilimitado)"`).
- Quando `available <= 0` e role selecionado é `dentist`:
  - Botão "Adicionar profissional" fica `disabled` com tooltip explicando o motivo.
  - Se o usuário clica mesmo assim (ou em fluxo paralelo), abre `SeatLimitDialog`.
- Trata resposta `code === 'seat_limit_reached'` da edge function abrindo o mesmo dialog.
- Chama `refetch()` após convite bem-sucedido.

**Novo componente `src/components/settings/SeatLimitDialog.tsx`**
- Modal amigável (shadcn Dialog, fade-in conforme regra de animação):
  - Ícone + título "Limite de profissionais atingido".
  - Texto: "Seu plano permite até {limit} profissionais. Faça upgrade para adicionar mais à sua equipe."
  - Botões: "Cancelar" e "Ver planos" → navega para `/settings?tab=subscription`.

### Resumo técnico

| Camada | Arquivo | Tipo |
|---|---|---|
| DB | nova migração | `get_clinic_seat_usage` + `check_clinic_seat_available` |
| Edge | `supabase/functions/invite-member/index.ts` | guard 403 antes de criar usuário |
| Hook | `src/hooks/useSeatUsage.ts` | novo |
| UI | `src/components/settings/TeamSection.tsx` | badge + botão desabilitado + tratamento de erro |
| UI | `src/components/settings/SeatLimitDialog.tsx` | novo modal de upgrade |

Sem mudanças em outros fluxos — apenas o convite de **dentista** é travado. Após sua aprovação, executo na ordem: migração → edge function → hook → UI.