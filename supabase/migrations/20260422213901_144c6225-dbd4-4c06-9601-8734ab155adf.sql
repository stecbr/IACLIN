-- Add clinical fields to clinical_records
ALTER TABLE public.clinical_records
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS history_present_illness text,
  ADD COLUMN IF NOT EXISTS symptom_duration text,
  ADD COLUMN IF NOT EXISTS physical_exam text,
  ADD COLUMN IF NOT EXISTS vital_signs jsonb,
  ADD COLUMN IF NOT EXISTS hypotheses jsonb,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS treatment_plan text,
  ADD COLUMN IF NOT EXISTS follow_up_date date,
  ADD COLUMN IF NOT EXISTS follow_up_reason text;

-- Create clinical_record_requests table
CREATE TABLE IF NOT EXISTS public.clinical_record_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_record_id uuid NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lab_exam','imaging_exam','prescription','referral')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crr_record ON public.clinical_record_requests(clinical_record_id);

ALTER TABLE public.clinical_record_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view record requests"
ON public.clinical_record_requests
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND (cr.clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), cr.clinic_id))
));

CREATE POLICY "Patients can view own record requests"
ON public.clinical_record_requests
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  JOIN public.patients p ON p.id = cr.patient_id
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND p.patient_user_id = auth.uid()
));

CREATE POLICY "Clinic members can insert record requests"
ON public.clinical_record_requests
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND (cr.clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), cr.clinic_id))
));

CREATE POLICY "Clinic members can update record requests"
ON public.clinical_record_requests
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND (cr.clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), cr.clinic_id))
));

CREATE POLICY "Clinic members can delete record requests"
ON public.clinical_record_requests
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND (cr.clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), cr.clinic_id))
));