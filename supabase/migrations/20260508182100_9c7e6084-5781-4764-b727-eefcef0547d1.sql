
-- Add dentist_id to patients to identify personal patients (clinic_id IS NULL)
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS dentist_id uuid;
CREATE INDEX IF NOT EXISTS idx_patients_dentist_id ON public.patients(dentist_id) WHERE dentist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_personal ON public.patients(dentist_id) WHERE clinic_id IS NULL;

-- Backfill: if there are personal patients (clinic_id IS NULL) try to associate with first appointment dentist
UPDATE public.patients p
SET dentist_id = a.dentist_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, dentist_id
  FROM public.appointments
  ORDER BY patient_id, created_at
) a
WHERE p.clinic_id IS NULL AND p.dentist_id IS NULL AND a.patient_id = p.id;

-- Tighten patients RLS: clinic_id IS NULL records only visible/editable by the owning dentist
DROP POLICY IF EXISTS "Clinic members can view patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic members can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Clinic members can update patients" ON public.patients;

CREATE POLICY "Clinic members or personal owner can view patients"
ON public.patients FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
  OR (patient_user_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can insert patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can update patients"
ON public.patients FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

-- Tighten appointments RLS for personal scope (clinic_id IS NULL → only owning dentist)
DROP POLICY IF EXISTS "Clinic members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clinic members can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clinic members can update appointments" ON public.appointments;

CREATE POLICY "Clinic members or personal owner can view appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can insert appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

-- Tighten clinical_records
DROP POLICY IF EXISTS "Clinic members can view clinical records" ON public.clinical_records;
DROP POLICY IF EXISTS "Clinic members can insert clinical records" ON public.clinical_records;
DROP POLICY IF EXISTS "Clinic members can update clinical records" ON public.clinical_records;

CREATE POLICY "Clinic members or personal owner can view clinical records"
ON public.clinical_records FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can insert clinical records"
ON public.clinical_records FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can update clinical records"
ON public.clinical_records FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

-- Tighten financial_transactions
DROP POLICY IF EXISTS "Clinic members can view transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Clinic members can insert transactions" ON public.financial_transactions;
DROP POLICY IF EXISTS "Clinic members can update transactions" ON public.financial_transactions;

CREATE POLICY "Clinic members or personal owner can view transactions"
ON public.financial_transactions FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can insert transactions"
ON public.financial_transactions FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or personal owner can update transactions"
ON public.financial_transactions FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);
