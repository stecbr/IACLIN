ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_requested_by uuid,
  ADD COLUMN IF NOT EXISTS approval_decided_by uuid,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_financial_tx_approval
  ON public.financial_transactions (clinic_id, approval_status);
