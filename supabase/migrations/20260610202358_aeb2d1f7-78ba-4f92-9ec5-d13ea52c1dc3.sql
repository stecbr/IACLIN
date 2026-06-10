CREATE POLICY "clinic admins read clinic-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinic-documents'
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.clinic_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "clinic admins upload clinic-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-documents'
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.clinic_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "clinic admins delete clinic-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinic-documents'
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.clinic_id::text = (storage.foldername(name))[1]
    )
  );
