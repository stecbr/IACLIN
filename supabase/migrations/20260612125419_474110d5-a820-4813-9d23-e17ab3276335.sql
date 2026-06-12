ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS operator_id uuid NULL REFERENCES public.insurance_operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS insurance_invoice_period text NULL,
  ADD COLUMN IF NOT EXISTS insurance_invoice_status text NULL CHECK (insurance_invoice_status IN ('open','sent','paid'));

CREATE INDEX IF NOT EXISTS idx_financial_tx_operator_period
  ON public.financial_transactions(operator_id, insurance_invoice_period)
  WHERE operator_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';