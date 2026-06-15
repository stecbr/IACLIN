## Problema

O dialog **"Forma de pagamento"** (FinishPaymentDialog) tenta inserir em `financial_transactions.payment_method` valores que o CHECK constraint do banco não aceita.

Constraint atual permite só: `cash`, `credit_card`, `debit_card`, `pix`, `insurance`, `bank_transfer`.

Mas o código grava:
- **Convênio** → `insurance:<NomeOperadora>` ❌ (rejeitado — tem o sufixo)
- **Particular agora (Stripe)** → `stripe` ❌
- **A combinar** → `particular_pending` ❌

Resultado: erro `violates check constraint "financial_transactions_payment_method_check"` nos três fluxos.

## Correção

**Migração única** ampliando o CHECK para aceitar os valores que a app realmente usa, mantendo o vínculo com a operadora via coluna estruturada `operator_id` (que já existe e é preenchida):

```sql
ALTER TABLE public.financial_transactions
  DROP CONSTRAINT financial_transactions_payment_method_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_payment_method_check
  CHECK (
    payment_method IS NULL OR
    payment_method IN (
      'cash','credit_card','debit_card','pix','insurance',
      'bank_transfer','stripe','particular_pending'
    ) OR
    payment_method LIKE 'insurance:%'
  );
```

O padrão `insurance:<Nome>` é mantido por compatibilidade com registros já existentes e com `ConsultationPaymentDialog.tsx` (que também grava nesse formato). O `operator_id` continua sendo a fonte estruturada para joins/relatórios.

## Validação pós-fix

Testar os 3 botões em uma consulta real:
1. **Convênio** → escolher operadora → confirmar → tx criada com `payment_method='insurance:<Nome>'`, `status='pending'`, `operator_id` setado.
2. **Particular agora** → confirmar → tx criada com `payment_method='stripe'`, `status='pending'`, link Stripe aberto.
3. **A combinar** → confirmar → tx criada com `payment_method='particular_pending'`, `status='pending'`, aparece em Contas a Receber.

## Fora do escopo

- Não altero UI nem lógica do dialog.
- Não mexo em `ConsultationPaymentDialog` (versão antiga já compatível).
- Sem mudança no fluxo Stripe / webhook.