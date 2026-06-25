## Problema
Hoje, ao clicar em "Finalizar" um atendimento na Sala de Espera, o card some imediatamente da coluna "Em atendimento" — não há uma etapa intermediária para registrar o pagamento. Se a recepção não cobrar na hora, o lançamento financeiro é esquecido.

## Solução
Adicionar uma 4ª coluna **"Aguardando pagamento"** entre "Em atendimento" e os finalizados (que continuam contados no KPI, mas saem do kanban).

### Novo fluxo de presença
```
not_arrived → arrived → in_service → awaiting_payment → finished
                                                    ↘ no_show
```

### Mudanças na UI (`src/pages/WaitingRoom.tsx` + `WaitingRoomCard.tsx`)

1. **Kanban passa a ter 4 colunas** (em telas grandes): Aguardados · Na recepção · Em atendimento · Aguardando pagamento.
2. **Botão "Finalizar atendimento"** no card "Em atendimento" passa a mover o paciente para **Aguardando pagamento** (não mais direto pra finalizado).
3. **Coluna "Aguardando pagamento"** mostra:
   - Nome, profissional, horário e tempo desde que saiu do atendimento.
   - Badge com valor sugerido (soma dos procedimentos do prontuário da consulta) ou "Sem valor lançado".
   - Botão primário **"Registrar pagamento"** → abre o `FinishPaymentDialog` já existente.
   - Botão secundário **"Cobrar depois"** → marca como `finished` sem lançamento (gera notificação/alerta de pendência financeira no card do paciente).
4. **KPI "Finalizados"** vira **"Aguardando pagamento"** + mantém o tile de "Finalizados" como contador.
5. Ao concluir o `FinishPaymentDialog` com sucesso, o status passa automaticamente para `finished` e o card sai do kanban.

### Mudanças de dados
- Adicionar o valor `'awaiting_payment'` ao enum/coluna `appointments.presence_status` (atualmente: `not_arrived | arrived | in_service | finished | no_show`).
- Migration simples; sem mudança de RLS ou grants — coluna já existente.
- Atualizar todos os filtros que usam `presence_status` (sala de espera, agenda, dashboard) para considerar o novo estado como "ainda ativo no dia".

### Detalhes técnicos
- A função `updatePresence` ganha o estado intermediário; finalização agora ocorre só quando: (a) pagamento é registrado com sucesso, ou (b) usuário escolhe "Cobrar depois".
- Se já existir `financial_transaction` para a consulta, o card pula direto para `finished` (evita duplicar).
- Mobile: as 4 colunas viram um stack com tabs ou scroll horizontal (segue o padrão atual).

## Fora do escopo
- Cobrança automática (Pix/cartão) — continua sendo registro manual via `FinishPaymentDialog`.
- Mudança no fluxo de comissionamento / NPS / lembretes pós-consulta.
