ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_payment_method_check;

ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method = ANY (ARRAY[
      'cash','credit_card','debit_card','pix','insurance','bank_transfer','stripe',
      'particular_pending','card','cash_pix','commission','to_arrange'
    ])
    OR payment_method LIKE 'insurance:%'
  );