
DO $$ BEGIN
  CREATE POLICY "clinic members upload automation media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = 'automation-media'
    AND public.user_belongs_to_clinic(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "clinic members update automation media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = 'automation-media'
    AND public.user_belongs_to_clinic(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "clinic members delete automation media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = 'automation-media'
    AND public.user_belongs_to_clinic(auth.uid(), ((storage.foldername(name))[2])::uuid)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public read automation media"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'clinic-assets'
    AND (storage.foldername(name))[1] = 'automation-media'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
