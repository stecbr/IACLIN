
ALTER TABLE public.commission_rules
  ALTER COLUMN dentist_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_clinic_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS commission_rules_clinic_default_idx
  ON public.commission_rules(clinic_id) WHERE is_clinic_default = true;
