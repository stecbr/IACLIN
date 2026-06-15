
-- documents: permitir paciente inserir e excluir exames próprios
CREATE POLICY "Patients can upload own exams"
  ON public.documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND category = 'patient_exam'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = documents.patient_id
        AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can delete own uploaded exams"
  ON public.documents FOR DELETE
  USING (
    uploaded_by = auth.uid()
    AND category = 'patient_exam'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = documents.patient_id
        AND p.patient_user_id = auth.uid()
    )
  );

-- storage.objects: políticas para bucket patient-files na pasta patient-uploads
CREATE POLICY "Patients can upload exam files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'patient-files'
    AND (storage.foldername(name))[2] = 'patient-uploads'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can read own exam files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'patient-files'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can delete own exam files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'patient-files'
    AND (storage.foldername(name))[2] = 'patient-uploads'
    AND EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.patient_user_id = auth.uid()
    )
  );
