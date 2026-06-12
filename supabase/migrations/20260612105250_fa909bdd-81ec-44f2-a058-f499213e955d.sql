CREATE POLICY "Credentialed clinic members read price files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'operator-price-files'
  AND EXISTS (
    SELECT 1 FROM public.operator_credentialings oc
    JOIN public.clinic_members cm ON cm.clinic_id = oc.clinic_id
    WHERE cm.user_id = auth.uid()
      AND oc.status = 'approved'
      AND oc.operator_id::text = split_part(storage.objects.name, '/', 2)
  )
);