## Problema

O erro `financial_transactions_payment_method_check` ocorre porque o constraint do banco só aceita os valores antigos (`cash`, `credit_card`, `debit_card`, `pix`, `insurance`, `bank_transfer`, `stripe`, `particular_pending`, ou `insurance:%`), mas a UI nova grava `card` (Cartão / Pago) e `cash_pix` (Dinheiro / Pix do orçamento) — que não estão na lista. Por isso o "Confirmar pagamento" falha.

## Correção

Migração única que expande o CHECK constraint de `public.financial_transactions.payment_method` para também aceitar:

- `card` — usado pelo `FinishPaymentDialog` ("Cartão / Pago") e `BudgetPaymentDialog`
- `cash_pix` — usado pelo `BudgetPaymentDialog` ("Dinheiro / Pix")
- `commission` — já é gravado por `src/lib/commissions.ts` ao criar a despesa de repasse (também não está no check atual)

Passos:

1. `ALTER TABLE public.financial_transactions DROP CONSTRAINT financial_transactions_payment_method_check;`
2. Recriar o CHECK incluindo os 3 novos valores além dos já existentes, mantendo `NULL` e o prefixo `insurance:%`.

Nenhuma alteração de código frontend é necessária — a UI já está alinhada com a regra de negócio nova ("Cartão / Pago", "Convênio", "A combinar"). Após a migração, finalizar a consulta vai gravar a transação normalmente.
