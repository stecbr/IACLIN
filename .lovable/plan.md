## Diagnóstico: por que não apareceu nada no financeiro

Investiguei o caso do Marcio (`marcio@gmail.com`) atendendo o Flavio na clínica **lucas ferreira** e encontrei **3 problemas reais** que, juntos, fazem com que o gestor da clínica não veja despesa nenhuma.

### Como o fluxo deveria funcionar (resumo)
1. Profissional finaliza atendimento → `FinishPaymentDialog` cria 1 `financial_transaction` do tipo **income** (receita da clínica) com `dentist_id` = profissional, valor = preço da consulta.
2. `generateCommissionsForTransaction()` lê as `commission_rules` daquele dentista naquela clínica e, se existir regra, cria 1 transação **expense / commission** (despesa de repasse).
3. Essa despesa aparece para o gestor em **Financeiro → Operacional / Repasses** e para o profissional em **Meu Financeiro → A receber**.

### Problemas encontrados

**1. Não existe regra de comissão para o Marcio**
Na clínica `lucas ferreira` só existe 1 regra de comissão, e está atribuída a outro dentista (`10086153-…`), não ao Marcio. Sem regra → nenhuma despesa de comissão é gerada. É exatamente o que o "stack overflow" interno descreve.

**2. As 2 consultas de hoje (29/06) finalizadas como `completed` não geraram nenhum `financial_transaction`**
Os agendamentos `120f13f4…` e `f068e917…` do Flavio estão com status `completed`, mas não existe nenhuma linha em `financial_transactions` para eles. Ou seja, o `FinishPaymentDialog` não chegou a registrar pagamento (provavelmente foi finalizado direto pelo botão "Finalizar" sem passar pelo modal de pagamento, ou marcado como "A combinar" sem valor).

**3. A transação que existe (consulta do dia 26) está com `dentist_id` errado e `amount = 0`**
A única transação ligada aos atendimentos do Marcio (`ac25021b…`) tem:
- `dentist_id = e44c667c…` (= `jesuss@gmail.com`, outro profissional) — provavelmente porque o dialog está pegando o dentista do contexto da clínica/usuário logado em vez do dentista do agendamento.
- `amount = 0.00`, `payment_method = particular_pending` → mesmo se existisse regra de 10%, 10% de 0 = 0.

### O que precisa ser decidido antes de eu codar

Para não sair corrigindo no escuro, preciso confirmar com você:

**A. Origem do valor da consulta.** Hoje, quando o profissional finaliza, o valor da consulta vem de onde?
- (a) preço cadastrado no procedimento/serviço da clínica
- (b) digitado manualmente no modal de pagamento
- (c) deve puxar do orçamento aprovado vinculado àquela consulta

**B. Quando criar a transação de receita.** Devo:
- (a) sempre criar uma transação no `completed` (mesmo que o pagamento seja "A combinar", entrando como `pending`), OU
- (b) só criar quando a forma de pagamento for de fato registrada

**C. Regra de comissão padrão.** Quer que eu:
- (a) bloqueie a finalização e avise "Cadastre uma regra de comissão para este profissional" quando não existir regra, OU
- (b) crie silenciosamente uma transação de receita mas sem despesa de comissão (situação atual — gera o problema que você sentiu), OU
- (c) permita uma "regra padrão da clínica" (ex.: 30% para todo profissional sem regra específica)

### Plano provisório (sujeito às respostas acima)

1. **Bug do `dentist_id` errado** — auditar `FinishPaymentDialog.tsx` e garantir que o `dentist_id` da transação seja sempre `appointment.dentist_id`, não o `user.id` da sessão.
2. **Bug de transação não criada quando `completed` sem pagamento** — em `Attendance.tsx`, ao finalizar sem registro de pagamento, criar transação `income / pending / particular_pending` com valor do procedimento, para o repasse poder ser calculado depois.
3. **UX de regra de comissão ausente** — no modal de finalização e em `TeamSection`, mostrar aviso quando o profissional não tem regra, com atalho "Cadastrar regra agora" para o admin.
4. **Painel do gestor (`PayoutsPanel` + `Financial → Operacional`)** — adicionar um card "Atendimentos sem comissão configurada" listando profissionais com consultas finalizadas mas sem regra, para o dono não ser pego de surpresa.
5. **Recalcular comissões retroativas** — RPC `recalculate_commissions(clinic_id)` para, após cadastrar uma regra, gerar as despesas das consultas já finalizadas.

Me responda A, B e C que eu fecho o plano final e parto pra implementação.
