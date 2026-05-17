CREATE TABLE public.patient_dependents_insurance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_account_id UUID NOT NULL REFERENCES public.patient_accounts(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  full_name TEXT NOT NULL,
  insurance_provider TEXT,
  insurance_number TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_dependents_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view dependents"
  ON public.patient_dependents_insurance FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patient_accounts pa WHERE pa.id = patient_account_id AND pa.user_id = auth.uid()));

CREATE POLICY "Owner can insert dependents"
  ON public.patient_dependents_insurance FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.patient_accounts pa WHERE pa.id = patient_account_id AND pa.user_id = auth.uid()));

CREATE POLICY "Owner can update dependents"
  ON public.patient_dependents_insurance FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patient_accounts pa WHERE pa.id = patient_account_id AND pa.user_id = auth.uid()));

CREATE POLICY "Owner can delete dependents"
  ON public.patient_dependents_insurance FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patient_accounts pa WHERE pa.id = patient_account_id AND pa.user_id = auth.uid()));

CREATE TRIGGER set_patient_dependents_insurance_updated_at
  BEFORE UPDATE ON public.patient_dependents_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patient_dependents_account ON public.patient_dependents_insurance(patient_account_id);