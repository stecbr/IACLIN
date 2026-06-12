ALTER TABLE public.patient_accounts
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS profession text;