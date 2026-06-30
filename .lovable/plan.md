## 1. Ajustes visuais — card "Aguardando pagamento" da Sala de Espera

Arquivo: `src/components/waiting-room/WaitingRoomCard.tsx`

O card fica apertado porque os botões "Registrar pagamento" + "Cobrar depois" disputam espaço na mesma linha dentro de uma coluna estreita do Kanban. Vou:

- Empilhar os botões verticalmente (`flex-col`) na seção `awaiting_payment`, com largura cheia (`w-full`) e altura `h-8`.
- Reduzir o padding do card de `p-4` para `p-3` e o espaçamento interno de `space-y-3` para `space-y-2.5`.
- Encolher a linha "Dr(a). … • especialidade" para uma única linha truncada (já está, mas vou apertar `gap-1` e `text-[11px]`).
- Trocar o botão "Prontuário" por um link sutil (texto pequeno + ícone) acima dos botões de ação, liberando espaço.
- Botão principal de "Registrar pagamento" continua verde e em destaque; "Cobrar depois" vira `variant="ghost"` mais discreto (é ação secundária).

Nenhuma mudança nos outros estados (Aguardados / Na recepção / Em atendimento) além das medidas globais do card.

## 2. Sair da página após confirmar o pagamento

Arquivo: `src/pages/WaitingRoom.tsx`

Hoje o `onCompleted` do `FinishPaymentDialog` só fecha o modal e invalida as queries — o usuário fica parado na Sala de Espera. Vou:

- No `onCompleted`, chamar `navigate('/agenda')` após o `toast.success` (já existente no dialog).
- Passar `appointmentDentistId={paymentApt.dentistId}` para o `FinishPaymentDialog` (hoje não é passado — o dialog está atribuindo o `dentist_id` ao usuário logado, e não ao médico da consulta).
- Acrescentar `dentistId` ao estado `paymentApt` e carregá-lo junto em `handleRegisterPayment` (já buscamos o appointment; basta selecionar `dentist_id`).

## 3. Comissões do Marcio não aparecem em "Repasses"

Diagnóstico após inspecionar a base:

- Existe a receita do atendimento (`financial_transactions` com `type=income`, R$ 150, `dentist_id` correto).
- **Não existe nenhuma `commission_rules` cadastrada para a clínica** — nem regra específica do Marcio, nem `is_clinic_default = true`.
- Sem regra, o `generateCommissionsForTransaction` em `src/lib/commissions.ts` retorna sem criar a despesa `category='commission'`, e o painel "Comissões em aberto" fica vazio (ele só lista despesas dessa categoria).

Correções de UX para deixar isso claro (sem mudar a regra de negócio):

a) **Aviso no painel de Repasses** (`src/components/finance/PayoutsPanel.tsx`): quando não houver nenhuma `commission_rules` ativa na clínica, mostrar um alerta amarelo acima de "Comissões em aberto" com texto:

> "Nenhuma regra de comissão cadastrada. As consultas não vão gerar repasses automáticos enquanto você não criar uma regra padrão da clínica ou uma regra individual em **Financeiro → Comissões**."

E um botão "Criar regra" levando para a aba Comissões. Vou usar uma query simples (`select count from commission_rules where clinic_id = ?`) com `react-query`.

b) **Reprocessar a consulta do Marcio**: depois que o usuário cadastrar a regra (padrão ou individual), as receitas antigas continuariam sem comissão. Para resolver isso vou adicionar um botão discreto "Recalcular comissões em aberto" no mesmo aviso, que percorre `financial_transactions` (`type=income`, `status in (pending, paid)`, `clinic_id` atual, sem expense correspondente) e chama `generateCommissionsForTransaction(id, 'after_procedure')` para cada uma. Idempotência já está garantida pela tag `[rule:id]` na coluna `notes`.

c) **Correção do bug de atribuição** descrito no item 2 (passar o `dentist_id` do agendamento) impede que pagamentos registrados pela recepcionista atribuam a receita à conta dela em vez do médico que atendeu.

## Resumo dos arquivos tocados

- `src/components/waiting-room/WaitingRoomCard.tsx` — visual do card
- `src/pages/WaitingRoom.tsx` — redirecionamento + `appointmentDentistId`
- `src/components/finance/PayoutsPanel.tsx` — alerta + botão "Recalcular comissões em aberto"

Nenhuma migração de banco é necessária.
