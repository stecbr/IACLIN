
ALTER TABLE public.insurance_operators
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_district text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text,
  ADD COLUMN IF NOT EXISTS phone_area_code text,
  ADD COLUMN IF NOT EXISTS fax text,
  ADD COLUMN IF NOT EXISTS representative_role text,
  ADD COLUMN IF NOT EXISTS ans_registered_at date;

CREATE UNIQUE INDEX IF NOT EXISTS insurance_operators_ans_code_uniq
  ON public.insurance_operators (ans_code)
  WHERE ans_code IS NOT NULL;
