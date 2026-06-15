## Problema

No modal "Forma de pagamento", quando o paciente tem convênio (ex.: Unimed) mas o procedimento não tem código TUSS ou não está na tabela vigente da operadora, o sistema mostra "sem valor" e **desabilita** o botão "Confirmar convênio". O médico fica travado — não consegue encerrar a consulta mesmo o paciente sendo da clínica e do convênio.

## Correção

Arquivo: `src/components/attendance/FinishPaymentDialog.tsx`

1. **Fallback automático para o valor particular** quando o item não tem valor na tabela TUSS da operadora:
   - Cada linha passa a exibir o `value_brl` da tabela quando existe; caso contrário, mostra o valor particular do catálogo da clínica com uma tag discreta "valor particular" (no lugar do atual "sem valor" em vermelho).
   - `insuranceTotal` passa a somar `insuranceValue ?? price` para cada linha (em vez de tratar `null` como zero).
   - Remover o estado de erro `insuranceHasMissing` que bloqueia o submit.

2. **Habilitar o botão "Confirmar convênio"** sempre que houver uma operadora selecionada — não importa se há ou não TUSS cadastrado. A condição passa a ser apenas `!operatorId || saving`.

3. **Substituir o aviso âmbar** "Procedimentos sem valor na tabela…" por uma nota informativa neutra: "Procedimentos sem valor na tabela usaram o valor particular do catálogo da clínica." Mostrar somente quando ao menos uma linha caiu no fallback.

4. **Gravar a transação corretamente** em `handleConfirmInsurance`:
   - `amount` = `insuranceTotal` (que já inclui o fallback particular).
   - `notes` continua listando cada procedimento com o valor usado (tabela ou particular), para o histórico da clínica/operadora deixar claro de onde veio cada preço.
   - `operator_id`, `insurance_invoice_period` e `insurance_invoice_status` continuam iguais — assim o atendimento aparece na fatura do mês como hoje.

5. **Quando o convênio selecionado não tem `operatorId`** (convênio da clínica sem TUSS, ou convênio do paciente não casado com operadora cadastrada), o resumo de procedimentos passa a ser exibido com os valores particulares da clínica (já era assim no `amount`, mas o painel de valores ficava oculto). O painel "Valores" passa a aparecer sempre que `mode === 'insurance'` e `operatorId` está preenchido.

## Fora de escopo

- Nenhuma alteração de schema, RLS ou edge functions.
- Sem mudanças no `ConsultationPaymentDialog` legado, no fluxo de Stripe ou "A combinar".
- Sem alterar a lógica de fatura mensal — a transação continua entrando como `pending` na fatura do mês.

## Como testar

1. Paciente com `insurance_provider = "Unimed"`, sem credenciamento pessoal e sem item TUSS cadastrado.
2. Finalizar consulta → modal abre em "Convênio" com Unimed pré-selecionada.
3. O painel "Valores conforme tabela vigente" mostra o procedimento com o valor particular (R$ 50,00) e nota "valor particular" ao lado.
4. **Total convênio: R$ 50,00**.
5. Botão "Confirmar convênio" está habilitado. Clicar grava a transação como `insurance` pendente, com `operator_id` da Unimed e `notes` listando o procedimento e o preço usado.
6. Caso a tabela TUSS tenha o item, comportamento permanece igual ao atual (preço da tabela prevalece).
