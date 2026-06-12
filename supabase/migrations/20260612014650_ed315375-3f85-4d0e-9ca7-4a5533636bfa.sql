
ALTER TABLE public.insurance_operators
  ADD COLUMN IF NOT EXISTS active_states text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_operator_price_tables_operator_state
  ON public.operator_price_tables(operator_id, state);
