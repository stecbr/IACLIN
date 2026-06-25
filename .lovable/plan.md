## Diagnóstico

Na implementação anterior atualizei os KPIs (4 tiles) e o `WaitingRoomCard`, mas o grid do kanban em `src/pages/WaitingRoom.tsx` ficou em `lg:grid-cols-3` com apenas 3 `<Column>` renderizadas. Faltou:

1. Calcular a lista `awaitingPayment` (`presence_status === 'awaiting_payment'`).
2. Mudar o grid para `lg:grid-cols-4`.
3. Renderizar a 4ª coluna "Aguardando pagamento" passando `onRegisterPayment` e um novo handler "Cobrar depois" (finalizar sem lançamento).
4. Ajustar `updatePresence` para aceitar `awaiting_payment` (sem alterar `status` ainda — só finaliza quando sair dessa coluna).

## Plano

**`src/pages/WaitingRoom.tsx`**
- Adicionar `const awaitingPayment = enriched.filter(a => a.presence_status === 'awaiting_payment')`.
- Incluir `awaiting_payment` na união de tipos de `updatePresence` e tratar como atualização apenas de `presence_status`.
- Trocar grid para `grid-cols-1 lg:grid-cols-4` e adicionar a 4ª `<Column title="Aguardando pagamento" color="blue">` com os cards da lista, conectando `onRegisterPayment={handleRegisterPayment}` e `onMarkFinished={(id) => updatePresence(id, 'finished')}` (botão "Cobrar depois").
- Adicionar variante `'blue'` no `Column` (`border-t-blue-500`).
- Reduzir `max-h` das colunas para caber 4 lado a lado (mantém `overflow-y-auto`).

**Verificação**
- Confirmar via screenshot Playwright em `/sala-de-espera` que aparecem 4 colunas e que ao clicar em "Concluir atendimento" o card move para "Aguardando pagamento".
