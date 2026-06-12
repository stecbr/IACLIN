
CREATE POLICY "Operator members read price files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'operator-price-files'
  AND EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.user_id = auth.uid()
      AND om.operator_id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "Operator members upload price files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'operator-price-files'
  AND EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.user_id = auth.uid()
      AND om.operator_id::text = split_part(name, '/', 2)
  )
);

CREATE POLICY "Operator members delete price files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'operator-price-files'
  AND EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.user_id = auth.uid()
      AND om.operator_id::text = split_part(name, '/', 2)
  )
);
