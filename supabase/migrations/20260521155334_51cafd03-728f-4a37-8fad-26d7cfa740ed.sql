ALTER TABLE public.treatment_plan_items
  ALTER COLUMN procedure_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS custom_procedure_name text;

ALTER TABLE public.treatment_plan_items
  DROP CONSTRAINT IF EXISTS treatment_plan_items_procedure_required;

ALTER TABLE public.treatment_plan_items
  ADD CONSTRAINT treatment_plan_items_procedure_required
  CHECK (procedure_id IS NOT NULL OR (custom_procedure_name IS NOT NULL AND length(btrim(custom_procedure_name)) > 0));