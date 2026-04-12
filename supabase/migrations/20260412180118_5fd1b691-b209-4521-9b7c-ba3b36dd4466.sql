
-- Helper: check if user belongs to at least one clinic
CREATE OR REPLACE FUNCTION public.user_belongs_to_clinic(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id AND clinic_id = _clinic_id
  )
$$;

-- ===================== APPOINTMENTS =====================
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
CREATE POLICY "Clinic members can insert appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
CREATE POLICY "Clinic members can update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can view appointments" ON public.appointments;
CREATE POLICY "Clinic members can view appointments"
ON public.appointments FOR SELECT TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

-- ===================== PATIENTS =====================
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
CREATE POLICY "Clinic members can insert patients"
ON public.patients FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;
CREATE POLICY "Clinic members can update patients"
ON public.patients FOR UPDATE TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;
CREATE POLICY "Clinic members can view patients"
ON public.patients FOR SELECT TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

-- ===================== FINANCIAL TRANSACTIONS =====================
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.financial_transactions;
CREATE POLICY "Clinic members can insert transactions"
ON public.financial_transactions FOR INSERT TO authenticated
WITH CHECK (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can update transactions" ON public.financial_transactions;
CREATE POLICY "Clinic members can update transactions"
ON public.financial_transactions FOR UPDATE TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.financial_transactions;
CREATE POLICY "Clinic members can view transactions"
ON public.financial_transactions FOR SELECT TO authenticated
USING (
  clinic_id IS NULL OR user_belongs_to_clinic(auth.uid(), clinic_id)
);

-- ===================== DOCUMENTS =====================
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
CREATE POLICY "Clinic members can insert documents"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
CREATE POLICY "Clinic members can view documents"
ON public.documents FOR SELECT TO authenticated
USING (true);

-- ===================== ODONTOGRAM ENTRIES =====================
DROP POLICY IF EXISTS "Authenticated users can insert odontogram" ON public.odontogram_entries;
CREATE POLICY "Clinic members can insert odontogram"
ON public.odontogram_entries FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update odontogram" ON public.odontogram_entries;
CREATE POLICY "Clinic members can update odontogram"
ON public.odontogram_entries FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view odontogram" ON public.odontogram_entries;
CREATE POLICY "Clinic members can view odontogram"
ON public.odontogram_entries FOR SELECT TO authenticated
USING (true);

-- ===================== TREATMENT PLANS =====================
DROP POLICY IF EXISTS "Authenticated users can insert treatment plans" ON public.treatment_plans;
CREATE POLICY "Clinic members can insert treatment plans"
ON public.treatment_plans FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update treatment plans" ON public.treatment_plans;
CREATE POLICY "Clinic members can update treatment plans"
ON public.treatment_plans FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view treatment plans" ON public.treatment_plans;
CREATE POLICY "Clinic members can view treatment plans"
ON public.treatment_plans FOR SELECT TO authenticated
USING (true);

-- ===================== TREATMENT PLAN ITEMS =====================
DROP POLICY IF EXISTS "Authenticated users can insert plan items" ON public.treatment_plan_items;
CREATE POLICY "Clinic members can insert plan items"
ON public.treatment_plan_items FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update plan items" ON public.treatment_plan_items;
CREATE POLICY "Clinic members can update plan items"
ON public.treatment_plan_items FOR UPDATE TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view plan items" ON public.treatment_plan_items;
CREATE POLICY "Clinic members can view plan items"
ON public.treatment_plan_items FOR SELECT TO authenticated
USING (true);
