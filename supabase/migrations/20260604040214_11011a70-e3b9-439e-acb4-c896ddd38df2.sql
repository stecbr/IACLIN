
-- 1) clinical_record_procedures
DROP POLICY IF EXISTS "Clinic members can view record procedures" ON public.clinical_record_procedures;
DROP POLICY IF EXISTS "Clinic members can insert record procedures" ON public.clinical_record_procedures;
DROP POLICY IF EXISTS "Clinic members can update record procedures" ON public.clinical_record_procedures;

CREATE POLICY "Clinic members can view record procedures"
ON public.clinical_record_procedures FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_procedures.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

CREATE POLICY "Clinic members can insert record procedures"
ON public.clinical_record_procedures FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_procedures.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

CREATE POLICY "Clinic members can update record procedures"
ON public.clinical_record_procedures FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_procedures.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

-- 2) clinical_record_requests
DROP POLICY IF EXISTS "Clinic members can view record requests" ON public.clinical_record_requests;
DROP POLICY IF EXISTS "Clinic members can insert record requests" ON public.clinical_record_requests;
DROP POLICY IF EXISTS "Clinic members can update record requests" ON public.clinical_record_requests;
DROP POLICY IF EXISTS "Clinic members can delete record requests" ON public.clinical_record_requests;

CREATE POLICY "Clinic members can view record requests"
ON public.clinical_record_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

CREATE POLICY "Clinic members can insert record requests"
ON public.clinical_record_requests FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

CREATE POLICY "Clinic members can update record requests"
ON public.clinical_record_requests FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

CREATE POLICY "Clinic members can delete record requests"
ON public.clinical_record_requests FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.clinical_records cr
  WHERE cr.id = clinical_record_requests.clinical_record_id
    AND ((cr.clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), cr.clinic_id))
      OR (cr.clinic_id IS NULL AND cr.dentist_id = auth.uid()))
));

-- 3) notifications: tighten INSERT
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert scoped notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
);

-- 4) Re-assert REVOKE on clinics.invite_code
REVOKE SELECT (invite_code) ON public.clinics FROM anon, authenticated;
