-- 1) Procedures: per-clinic isolation
ALTER TABLE public.procedures ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE;

-- Backfill: assign existing procedures to the earliest clinic of matching category, when possible.
UPDATE public.procedures p
SET clinic_id = sub.cid
FROM (
  SELECT DISTINCT ON (c.category) c.category, c.id AS cid
  FROM public.clinics c
  ORDER BY c.category, c.created_at ASC
) sub
WHERE p.clinic_id IS NULL
  AND sub.category::text = p.specialty_category;

-- Any leftover orphan procedures: keep clinic_id NULL but mark them inactive so they don't pollute new clinics.
UPDATE public.procedures SET is_active = false WHERE clinic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_procedures_clinic_id ON public.procedures(clinic_id);

-- Reset policies (older ones likely had no clinic scoping)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='procedures' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.procedures', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "procedures_select_by_clinic"
  ON public.procedures FOR SELECT
  TO authenticated
  USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "procedures_insert_by_clinic"
  ON public.procedures FOR INSERT
  TO authenticated
  WITH CHECK (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "procedures_update_by_clinic"
  ON public.procedures FOR UPDATE
  TO authenticated
  USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
  WITH CHECK (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "procedures_delete_by_clinic"
  ON public.procedures FOR DELETE
  TO authenticated
  USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;

-- 2) Clinics: publication gate + welcome dismissal
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_dismissed_at timestamptz;

-- Backfill: existing clinics stay published so we don't break current flows.
UPDATE public.clinics SET is_published = true WHERE onboarding_completed_at IS NULL AND is_published = false;
UPDATE public.clinics SET onboarding_completed_at = COALESCE(onboarding_completed_at, created_at);

-- 3) profiles.bio for owner profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;