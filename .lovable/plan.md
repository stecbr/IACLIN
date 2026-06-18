## Causa

Em `mercadopago-create-subscription/index.ts` enviamos para `/preapproval`:
- `preapproval_plan_id` (plano-template)
- **E** `auto_recurring` + `payer_email` + `status: 'pending'`

Quando MP recebe `preapproval_plan_id` junto com `auto_recurring`, ele entra no fluxo "criar assinatura já autorizada" e exige `card_token_id` (cartão tokenizado no front via SDK do MP). Por isso o 400 `card_token_id is required`.

Para deixar o MP hospedar a coleta do cartão (sem precisar do SDK no front), o caminho correto é criar uma preapproval **standalone** (sem `preapproval_plan_id`), com `status: 'pending'` — o MP devolve `init_point` e o usuário autoriza/preenche cartão lá. É exatamente o fluxo redirect que já temos no front.

## Solução (só no backend, front não muda)

### Editar `supabase/functions/mercadopago-create-subscription/index.ts`
- Remover `preapproval_plan_id` do body do POST `/preapproval`.
- Manter: `reason`, `payer_email`, `back_url`, `external_reference`, `auto_recurring` (frequency, frequency_type, transaction_amount, currency_id, `start_date` = agora), `status: 'pending'`.
- Não precisa mais ler `mp_preapproval_plan_id` do plano (mas mantenho a coluna; o sync de plano ainda cria/atualiza o template caso o admin queira usar futuramente).
- Tirar a checagem que bloqueia quando `mp_preapproval_plan_id` está vazio (agora é opcional).
- Manter `upsert` em `platform_subscriptions` com `mp_preapproval_id`, `mp_init_point`, status `trial`.

### Nada muda no front
`SubscriptionSection.tsx` já redireciona para `data.url` (= `init_point`). MP coleta cartão e chama webhook ao autorizar; nosso `mercadopago-webhook` atualiza para `active`.

### Validação
1. Plano de R$ 20 já sincronizado.
2. Em `/settings` → Assinatura → "Assinar". Deve abrir o checkout do MP, pedir cartão, e ao concluir redirecionar para `back_url`.
3. Webhook deve disparar `preapproval` e marcar a `platform_subscriptions` como `active`.

## Fora de escopo
- Não vou integrar o SDK MP no front (Card Brick) agora — fluxo redirect é mais simples e suficiente.
- Não removo `mp_preapproval_plan_id` da tabela.

Confirma para aplicar?