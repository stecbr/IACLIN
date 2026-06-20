DROP POLICY IF EXISTS "Patients can view own record requests" ON public.clinical_record_requests;
CREATE POLICY "Patients can view own record requests"
ON public.clinical_record_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinical_records cr
    JOIN public.patients p ON p.id = cr.patient_id
    WHERE cr.id = clinical_record_requests.clinical_record_id
      AND p.patient_user_id = auth.uid()
  )
);