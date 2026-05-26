
-- ============================================================
-- 1. APPOINTMENTS: drop anon and broad authenticated SELECT
-- ============================================================
DROP POLICY IF EXISTS "Anon can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated can view all appointments" ON public.appointments;

-- ============================================================
-- 2. CLINIC_INVITES: drop "Anyone authenticated can read by token"
--    (token validation is done via edge function with service role)
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can read by token" ON public.clinic_invites;

-- ============================================================
-- 3. CLINIC_MEMBERS: drop anon and broad authenticated SELECT
-- ============================================================
DROP POLICY IF EXISTS "Anon can view clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Authenticated can view all clinic members" ON public.clinic_members;

-- Keep "Members can view own clinic members" as the scoped policy.
-- Add a self-view policy so a user can always read their own membership row.
CREATE POLICY "Users can view own membership"
ON public.clinic_members FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============================================================
-- 4. CLINICS: hide invite_code from clients (revoke column SELECT)
--    Public/anon row read remains for marketplace, but invite_code
--    is no longer fetchable by anon or authenticated.
-- ============================================================
REVOKE SELECT (invite_code) ON public.clinics FROM anon;
REVOKE SELECT (invite_code) ON public.clinics FROM authenticated;
-- service_role retains full access via GRANT ALL ... TO service_role

-- ============================================================
-- 5. DOCUMENTS: replace broad policies with patient-scoped checks
-- ============================================================
DROP POLICY IF EXISTS "Clinic members can view documents" ON public.documents;
DROP POLICY IF EXISTS "Clinic members can insert documents" ON public.documents;

CREATE POLICY "Clinic members or owner can view documents"
ON public.documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = documents.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can insert documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = documents.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can update documents"
ON public.documents FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = documents.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

-- ============================================================
-- 6. ODONTOGRAM_ENTRIES: scope to clinic / dentist
-- ============================================================
DROP POLICY IF EXISTS "Clinic members can view odontogram" ON public.odontogram_entries;
DROP POLICY IF EXISTS "Clinic members can insert odontogram" ON public.odontogram_entries;
DROP POLICY IF EXISTS "Clinic members can update odontogram" ON public.odontogram_entries;

CREATE POLICY "Clinic members or owner can view odontogram"
ON public.odontogram_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = odontogram_entries.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can insert odontogram"
ON public.odontogram_entries FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = odontogram_entries.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can update odontogram"
ON public.odontogram_entries FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = odontogram_entries.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

-- ============================================================
-- 7. PROFILES: drop anon SELECT (only authenticated can view)
-- ============================================================
DROP POLICY IF EXISTS "Anon can view profiles" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

-- ============================================================
-- 8. TREATMENT_PLANS & TREATMENT_PLAN_ITEMS: scope to clinic/dentist
-- ============================================================
DROP POLICY IF EXISTS "Clinic members can view treatment plans" ON public.treatment_plans;
DROP POLICY IF EXISTS "Clinic members can insert treatment plans" ON public.treatment_plans;
DROP POLICY IF EXISTS "Clinic members can update treatment plans" ON public.treatment_plans;

CREATE POLICY "Clinic members or owner can view treatment plans"
ON public.treatment_plans FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = treatment_plans.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND treatment_plans.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can insert treatment plans"
ON public.treatment_plans FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = treatment_plans.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND treatment_plans.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can update treatment plans"
ON public.treatment_plans FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = treatment_plans.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND treatment_plans.dentist_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Clinic members can view plan items" ON public.treatment_plan_items;
DROP POLICY IF EXISTS "Clinic members can insert plan items" ON public.treatment_plan_items;
DROP POLICY IF EXISTS "Clinic members can update plan items" ON public.treatment_plan_items;

CREATE POLICY "Clinic members or owner can view plan items"
ON public.treatment_plan_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    JOIN public.patients p ON p.id = tp.patient_id
    WHERE tp.id = treatment_plan_items.treatment_plan_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND tp.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can insert plan items"
ON public.treatment_plan_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    JOIN public.patients p ON p.id = tp.patient_id
    WHERE tp.id = treatment_plan_items.treatment_plan_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND tp.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can update plan items"
ON public.treatment_plan_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.treatment_plans tp
    JOIN public.patients p ON p.id = tp.patient_id
    WHERE tp.id = treatment_plan_items.treatment_plan_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND tp.dentist_id = auth.uid())
      )
  )
);

-- ============================================================
-- 9. USER_ROLES: remove unrestricted INSERT (privilege escalation)
--    Role creation now only via SECURITY DEFINER functions (handle_new_user)
--    or service_role.
-- ============================================================
DROP POLICY IF EXISTS "System can insert roles" ON public.user_roles;

-- ============================================================
-- 10. WHATSAPP_INSTANCES: enable RLS + clinic-scoped policies
-- ============================================================
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view whatsapp instances"
ON public.whatsapp_instances FOR SELECT TO authenticated
USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic owners/admins can insert whatsapp instances"
ON public.whatsapp_instances FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IS NOT NULL AND (
    public.is_clinic_owner(auth.uid(), clinic_id)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  )
);

CREATE POLICY "Clinic owners/admins can update whatsapp instances"
ON public.whatsapp_instances FOR UPDATE TO authenticated
USING (
  clinic_id IS NOT NULL AND (
    public.is_clinic_owner(auth.uid(), clinic_id)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  )
);

CREATE POLICY "Clinic owners/admins can delete whatsapp instances"
ON public.whatsapp_instances FOR DELETE TO authenticated
USING (
  clinic_id IS NOT NULL AND (
    public.is_clinic_owner(auth.uid(), clinic_id)
    OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  )
);

-- ============================================================
-- 11. ANAMNESES & CLINICAL_MAP_ENTRIES: scope clinic_id IS NULL branch
-- ============================================================
-- anamneses: when clinic_id IS NULL, require filled_by = auth.uid()
-- OR patient.dentist_id = auth.uid()
DROP POLICY IF EXISTS "Clinic members can view anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Clinic members can insert anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Clinic members can update anamneses" ON public.anamneses;

CREATE POLICY "Clinic members or dentist can view anamneses"
ON public.anamneses FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND (
    filled_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = anamneses.patient_id AND p.dentist_id = auth.uid()
    )
  ))
);

CREATE POLICY "Clinic members or dentist can insert anamneses"
ON public.anamneses FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND (
    filled_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = anamneses.patient_id AND p.dentist_id = auth.uid()
    )
  ))
);

CREATE POLICY "Clinic members or dentist can update anamneses"
ON public.anamneses FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND (
    filled_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = anamneses.patient_id AND p.dentist_id = auth.uid()
    )
  ))
);

-- clinical_map_entries: when clinic_id IS NULL, require dentist_id = auth.uid()
DROP POLICY IF EXISTS "Clinic members can view clinical map entries" ON public.clinical_map_entries;
DROP POLICY IF EXISTS "Clinic members can insert clinical map entries" ON public.clinical_map_entries;
DROP POLICY IF EXISTS "Clinic members can update clinical map entries" ON public.clinical_map_entries;
DROP POLICY IF EXISTS "Clinic members can delete clinical map entries" ON public.clinical_map_entries;

CREATE POLICY "Clinic members or dentist can view clinical map entries"
ON public.clinical_map_entries FOR SELECT TO authenticated
USING (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or dentist can insert clinical map entries"
ON public.clinical_map_entries FOR INSERT TO authenticated
WITH CHECK (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or dentist can update clinical map entries"
ON public.clinical_map_entries FOR UPDATE TO authenticated
USING (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

CREATE POLICY "Clinic members or dentist can delete clinical map entries"
ON public.clinical_map_entries FOR DELETE TO authenticated
USING (
  (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  OR (clinic_id IS NULL AND dentist_id = auth.uid())
);

-- ============================================================
-- 12. STORAGE: patient-files bucket -> private + ownership scoped
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'patient-files';

DROP POLICY IF EXISTS "Anyone can view patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient files" ON storage.objects;

-- View: clinic members / personal dentist of patient OR the patient themself.
-- Convention: object path starts with the patient_id (uuid) as the first folder.
CREATE POLICY "Patient files viewable by patient or care team"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (
        p.patient_user_id = auth.uid()
        OR (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Patient files uploadable by care team"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Patient files deletable by care team"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-files'
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND p.dentist_id = auth.uid())
      )
  )
);

-- ============================================================
-- 13. STORAGE: statements bucket -> require own folder ownership
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view own statements" ON storage.objects;

CREATE POLICY "Users can view own statements"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'statements'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
