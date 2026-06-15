## Problema

No fim da consulta, o modal "Forma de pagamento" abre com a opção **Convênio** selecionada, mas o seletor de operadora fica vazio (ou o botão "Confirmar convênio" fica desabilitado) quando:

- O médico não tem credenciamento pessoal aprovado, **e**
- A clínica tem o convênio do paciente cadastrado, mas o `FinishPaymentDialog` não considera o **convênio que o próprio paciente já tem registrado** na ficha (`patients.insurance_provider`).

Resultado: o médico não consegue concluir a consulta — e como o encerramento exige escolher uma das três opções (Convênio / Particular agora / A combinar), ele fica travado.

## Correção (somente UI/lógica de listagem no modal)

Arquivo: `src/components/attendance/FinishPaymentDialog.tsx`

1. **Receber o convênio do paciente** como prop (`patientInsuranceProvider?: string | null`) — `Attendance.tsx` já tem o dado em `appointment.patients`.
2. **Montar a lista de operadoras em 3 grupos**, na ordem:
   - **Convênio do paciente** (quando `patientInsuranceProvider` existe) — tenta casar com `insurance_operators` por nome normalizado para obter `operatorId` (para buscar tabela TUSS). Se não casar, ainda assim aparece como opção (sem tabela TUSS, registro vai como "convênio sem valor automático", igual ao caso atual de plano da clínica sem `operator_id`).
   - **Credenciamento pessoal** (existente).
   - **Convênios da clínica** (existente).
   - Deduplicar por `operatorId` quando houver.
3. **Pré-selecionar** automaticamente a opção do "Convênio do paciente" ao abrir o modal e mudar para o modo `insurance`, para reduzir cliques.
4. **Mensagem de vazio mais útil**: quando não há nenhuma opção, mostrar texto orientando a (a) cadastrar convênio em Configurações → Convênios da clínica, (b) registrar o convênio na ficha do paciente, ou (c) usar "Particular agora" / "A combinar".
5. **Passar a prop** `patientInsuranceProvider={(appointment as any).patients?.insurance_provider ?? null}` em `src/pages/Attendance.tsx` onde o `FinishPaymentDialog` é renderizado.

## Fora de escopo

- Nenhuma alteração de schema, RLS, edge functions, ou no fluxo de criação de `financial_transactions`.
- Não mexer no `ConsultationPaymentDialog` legado.
- Não alterar a lógica de tabela TUSS / preços — apenas a montagem da lista de operadoras selecionáveis.

## Como testar

1. Logar como médico vinculado a uma clínica, sem credenciamento pessoal.
2. Abrir uma consulta de paciente que tenha `insurance_provider` preenchido (ex.: "Amil").
3. Finalizar → no modal, clicar em **Convênio**: a opção "Amil" deve aparecer já pré-selecionada em "Convênio do paciente".
4. Confirmar convênio deve gravar a transação como pendente para a fatura do mês, como hoje.
5. Caso o paciente seja particular (sem `insurance_provider`) e a clínica tenha convênios, comportamento atual permanece.
