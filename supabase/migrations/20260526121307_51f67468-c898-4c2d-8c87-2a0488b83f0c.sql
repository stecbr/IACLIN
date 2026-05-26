ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_cpf_key;
CREATE UNIQUE INDEX IF NOT EXISTS patients_cpf_clinic_unique ON public.patients (clinic_id, cpf) WHERE cpf IS NOT NULL AND clinic_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS patients_cpf_personal_unique ON public.patients (dentist_id, cpf) WHERE cpf IS NOT NULL AND clinic_id IS NULL;