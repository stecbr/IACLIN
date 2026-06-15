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