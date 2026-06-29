## Fluxo 1 — Cancelar assinatura da clínica (soft-cancel)

### Banco
- Migration em `platform_subscriptions`:
  - Adicionar `cancel_at_period_end BOOLEAN NOT NULL DEFAULT false`.
  - Adicionar `cancellation_requested_at TIMESTAMPTZ`.
  - Adicionar `cancellation_reason TEXT`.
- RPC `request_subscription_cancellation(_entity_type, _entity_id, _reason)`:
  - Verifica que `auth.uid()` é dono/admin daquela clínica.
  - Marca `cancel_at_period_end=true`, `cancellation_requested_at=now()`, `cancellation_reason=_reason`. NÃO muda `status` — fica `active`/`trialing` até `current_period_end`.
- RPC `reactivate_subscription(_entity_type, _entity_id)` para o botão "Reativar" enquanto ainda estiver dentro do período.
- Job de expiração (pg_cron diário): `UPDATE platform_subscriptions SET status='cancelled' WHERE cancel_at_period_end AND current_period_end < CURRENT_DATE AND status IN ('active','trial')`. Sem pg_cron habilitado, alternativa: uma Edge Function `subscription-expire-canceled` agendada manualmente; em qualquer caso o paywall continua dependendo apenas do `status`, então o efeito visual já é correto assim que a data passa porque também adicionamos check no `useSubscriptionStatus` (ver abaixo).

### Edge function
- Reaproveitar/ajustar `mercadopago-cancel-subscription`:
  - Em vez de marcar `status='cancelled'` imediato, chamar a preapproval do MP para parar a renovação (MP aceita `status='cancelled'` para encerrar cobranças futuras) e localmente apenas chamar a RPC `request_subscription_cancellation`. O webhook do MP continua a fonte da verdade para `status` final.
  - Tratar caso sem `mp_preapproval_id` (assinatura manual/trial) chamando direto a RPC.
- Nova edge function `reactivate-subscription` espelhando a operação inversa (best-effort, só funciona se ainda houver preapproval ativo no MP — caso não, instrui o usuário a refazer o checkout).

### Frontend — `src/components/settings/SubscriptionSection.tsx`
- Substituir o `confirm()` atual por um `<AlertDialog>` (fade-in puro, sem slide) com:
  - Título "Cancelar assinatura".
  - Texto explicando: renovação automática interrompida, acesso garantido até `current_period_end` formatado em pt-BR, depois disso o sistema bloqueia para regularização.
  - Campo opcional "Motivo do cancelamento".
  - Botões "Manter assinatura" / "Confirmar cancelamento".
- Após confirmar, invocar `mercadopago-cancel-subscription` (ou a RPC direto para assinaturas manuais), invalidar `['my-subscription']` e `['subscription-status']`.
- Quando `subscription.cancel_at_period_end === true`:
  - Esconder o botão "Cancelar".
  - Mostrar banner âmbar "Cancelamento agendado para DD/MM/AAAA" + botão "Reativar assinatura".

### `src/hooks/useSubscriptionStatus.ts`
- Selecionar também `cancel_at_period_end`.
- Expor `cancelAtPeriodEnd: boolean` e `isPendingCancellation` (active + cancel_at_period_end).
- Manter `isOverdueOrCancelled` baseado apenas em `status` — o paywall continua só disparando quando o status virar `cancelled`/`overdue`.

### `src/components/SubscriptionWarningBanner.tsx`
- Se `isPendingCancellation`, exibir variante específica: "Sua assinatura será encerrada em X dias. Reative para evitar o bloqueio." com link para `/settings?tab=subscription`.

---

## Fluxo 2 — Remoção de profissional (revogação total + assento liberado)

### Banco
- Atualizar a função `public.user_belongs_to_clinic` para considerar apenas vínculos ativos:
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id=_user_id AND clinic_id=_clinic_id
      AND COALESCE(is_active,true)=true
  )
  ```
  Isso revoga em cascata o acesso a `appointments`, `patients`, `clinical_records`, `financial_transactions`, `treatment_plans`, `clinic_member_*`, etc., porque todas as policies usam esse helper.
- `is_clinic_member(_user_id)` idem: passar a retornar apenas `clinic_id` onde `is_active=true`.
- `get_clinic_seat_usage`: passar a contar somente `is_active=true` (já contagem está com esse filtro; manter).
- RPC nova `remove_clinic_member(_member_id)` `SECURITY DEFINER`:
  - Verifica solicitante é dono/admin da clínica.
  - Bloqueia auto-remoção e remoção do último dono.
  - Hard delete da linha em `clinic_members` (o cascade já existe pelas FKs; especialidades, comissões pendentes ficam atreladas ao histórico via `dentist_id` mas o usuário deixa de enxergar).
  - Cria notificação tipo `system` para o profissional removido: "Você foi desvinculado da clínica X. Faça login para criar/entrar em outra clínica."
- RPC `set_clinic_member_active(_member_id, _is_active)` `SECURITY DEFINER` para a suspensão temporária, com as mesmas checagens.

### Frontend — `src/components/settings/TeamSection.tsx`
- Substituir o `delete` direto por chamada `supabase.rpc('remove_clinic_member', { _member_id })`.
- Confirmação em `<AlertDialog>` explicando: "O profissional perderá imediatamente acesso a agenda, pacientes, prontuários e financeiro desta clínica. O cadastro pessoal dele continua ativo no IACLIN."
- Toggle `is_active` passa a usar `set_clinic_member_active` (mantém UX atual com texto "Suspenso/Ativo" e libera assento — o usuário fica sem acesso pois `user_belongs_to_clinic` checa `is_active`).
- Invalidar `['clinic-members']`, `['clinic-seat-usage']`, e disparar `realtime` se o usuário removido estiver com app aberto (canal `clinic_members` já existente — verificar; se não, esse refresh acontece naturalmente no próximo `fetchUserData`).

### `src/contexts/AuthContext.tsx`
- Já filtra `is_active` para popular `clinics`; manter. Adicionar listener em `clinic_members` (subscribe realtime) para reexecutar `fetchUserData` quando uma linha do usuário atual for `UPDATE`/`DELETE` — garante logout instantâneo da clínica enquanto a sessão estiver aberta.
- Quando após o refresh `memberships.length === 0`, limpar `currentClinicId` e `localStorage` da clínica selecionada.

---

## Fluxo 3 — Transição para Solo/Autônomo

### Comportamento
- Profissional removido faz login → `AuthContext` carrega zero memberships → `currentClinicId = null`.
- `useSoloMode`/`Index.tsx` já tratam esse caso. Ajustes:
  - `src/pages/Index.tsx`: se usuário tem `role` profissional (dentist/médico) e `clinics.length === 0`, redirecionar para `/onboarding`.
  - `src/pages/Onboarding.tsx`: garantir que o fluxo permite "Criar minha própria clínica" (já existe) e, ao final, mostrar a assinatura `/settings?tab=subscription` para escolher plano antes de operar.
- Adicionar componente leve `SoloTransitionBanner` em `AppLayout` quando `clinics.length === 0 && !isPatient && !isOperator`: card amistoso "Você não está vinculado a nenhuma clínica. Crie sua clínica própria para começar a atender." + CTA `/onboarding`.
- Dados antigos: como o `user_belongs_to_clinic` agora exige vínculo ativo, ele não vê NADA da clínica anterior. Os registros antigos permanecem para a clínica (histórico do paciente, financeiro), apenas não são acessíveis pelo ex-profissional.

---

## Resumo de mudanças

### Banco (migrations)
| Arquivo | Conteúdo |
|---|---|
| nova migration | colunas `cancel_at_period_end`, `cancellation_requested_at`, `cancellation_reason` em `platform_subscriptions` |
| nova migration | RPCs `request_subscription_cancellation`, `reactivate_subscription`, `remove_clinic_member`, `set_clinic_member_active` |
| nova migration | atualiza `user_belongs_to_clinic` e `is_clinic_member` para exigir `is_active=true` |
| nova migration (opcional) | pg_cron para expirar assinaturas com `cancel_at_period_end` vencido |

### Edge functions
- `mercadopago-cancel-subscription`: ajustar para soft-cancel (não muda `status` localmente, só dispara MP + RPC).
- nova `reactivate-subscription` (opcional, best-effort).

### Frontend
| Arquivo | Mudança |
|---|---|
| `src/components/settings/SubscriptionSection.tsx` | AlertDialog de cancelamento, banner de cancelamento agendado, botão Reativar |
| `src/hooks/useSubscriptionStatus.ts` | expõe `cancelAtPeriodEnd`, `isPendingCancellation` |
| `src/components/SubscriptionWarningBanner.tsx` | variante "cancelamento agendado em X dias" |
| `src/components/settings/TeamSection.tsx` | usa RPCs + AlertDialog de remoção |
| `src/contexts/AuthContext.tsx` | realtime listener em `clinic_members`, limpa clínica ao ficar sem vínculos |
| `src/pages/Index.tsx` | redireciona profissional sem clínica para `/onboarding` |
| novo `src/components/SoloTransitionBanner.tsx` | banner para ex-membros sem clínica |

Após aprovação, executo na ordem: migrations → ajuste do edge function → hook → componentes de UI → AuthContext realtime → onboarding/solo.
