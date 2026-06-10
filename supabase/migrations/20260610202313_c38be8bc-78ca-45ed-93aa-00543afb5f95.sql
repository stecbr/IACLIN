ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'juridica',
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS inss_pis text,
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS cnes text,
  ADD COLUMN IF NOT EXISTS specialty_certificate text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_account_type text,
  ADD COLUMN IF NOT EXISTS bank_holder_document text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinics_entity_type_check') THEN
    ALTER TABLE public.clinics ADD CONSTRAINT clinics_entity_type_check CHECK (entity_type IN ('fisica','juridica'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.clinic_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_documents_clinic ON public.clinic_documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_documents_type ON public.clinic_documents(clinic_id, doc_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_documents TO authenticated;
GRANT ALL ON public.clinic_documents TO service_role;

ALTER TABLE public.clinic_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic admins read documents"
  ON public.clinic_documents FOR SELECT TO authenticated
  USING (public.is_clinic_owner(auth.uid(), clinic_id)
         OR EXISTS (SELECT 1 FROM public.clinic_members cm
                    WHERE cm.clinic_id = clinic_documents.clinic_id
                      AND cm.user_id = auth.uid()
                      AND cm.role = 'admin'));

CREATE POLICY "clinic admins insert documents"
  ON public.clinic_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_clinic_owner(auth.uid(), clinic_id)
              OR EXISTS (SELECT 1 FROM public.clinic_members cm
                         WHERE cm.clinic_id = clinic_documents.clinic_id
                           AND cm.user_id = auth.uid()
                           AND cm.role = 'admin'));

CREATE POLICY "clinic admins update documents"
  ON public.clinic_documents FOR UPDATE TO authenticated
  USING (public.is_clinic_owner(auth.uid(), clinic_id)
         OR EXISTS (SELECT 1 FROM public.clinic_members cm
                    WHERE cm.clinic_id = clinic_documents.clinic_id
                      AND cm.user_id = auth.uid()
                      AND cm.role = 'admin'));

CREATE POLICY "clinic admins delete documents"
  ON public.clinic_documents FOR DELETE TO authenticated
  USING (public.is_clinic_owner(auth.uid(), clinic_id)
         OR EXISTS (SELECT 1 FROM public.clinic_members cm
                    WHERE cm.clinic_id = clinic_documents.clinic_id
                      AND cm.user_id = auth.uid()
                      AND cm.role = 'admin'));
