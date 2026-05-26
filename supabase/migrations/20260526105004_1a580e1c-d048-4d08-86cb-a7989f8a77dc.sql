ALTER TABLE public.patient_chart_shares
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'professional';

ALTER TABLE public.patient_chart_shares
  ADD CONSTRAINT patient_chart_shares_source_check
  CHECK (source IN ('professional', 'patient'));