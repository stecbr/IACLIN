
-- 1. Personal specialties (per user, all clinics)
CREATE TABLE public.professional_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  specialty text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, specialty)
);
CREATE INDEX idx_professional_specialties_user ON public.professional_specialties(user_id);
ALTER TABLE public.professional_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view professional specialties"
  ON public.professional_specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view professional specialties"
  ON public.professional_specialties FOR SELECT TO anon USING (true);
CREATE POLICY "Users manage own specialties insert"
  ON public.professional_specialties FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own specialties update"
  ON public.professional_specialties FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own specialties delete"
  ON public.professional_specialties FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2. Clinic-scoped subset of specialties per member
CREATE TABLE public.clinic_member_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_member_id uuid NOT NULL REFERENCES public.clinic_members(id) ON DELETE CASCADE,
  specialty text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_member_id, specialty)
);
CREATE INDEX idx_cms_member ON public.clinic_member_specialties(clinic_member_id);
ALTER TABLE public.clinic_member_specialties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view member specialties"
  ON public.clinic_member_specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view member specialties"
  ON public.clinic_member_specialties FOR SELECT TO anon USING (true);
CREATE POLICY "Owner/admin or self can insert member specialties"
  ON public.clinic_member_specialties FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.id = clinic_member_id
        AND (
          cm.user_id = auth.uid()
          OR is_clinic_owner(auth.uid(), cm.clinic_id)
          OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), cm.clinic_id))
        )
    )
  );
CREATE POLICY "Owner/admin or self can delete member specialties"
  ON public.clinic_member_specialties FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.id = clinic_member_id
        AND (
          cm.user_id = auth.uid()
          OR is_clinic_owner(auth.uid(), cm.clinic_id)
          OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), cm.clinic_id))
        )
    )
  );

-- 3. Trigger: keep clinic_members.specialty synced with the first row of clinic_member_specialties
CREATE OR REPLACE FUNCTION public.sync_clinic_member_primary_specialty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_member uuid;
  first_specialty text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_member := OLD.clinic_member_id;
  ELSE
    target_member := NEW.clinic_member_id;
  END IF;

  SELECT specialty INTO first_specialty
    FROM public.clinic_member_specialties
    WHERE clinic_member_id = target_member
    ORDER BY created_at ASC
    LIMIT 1;

  UPDATE public.clinic_members
    SET specialty = first_specialty
    WHERE id = target_member;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_clinic_member_specialty
AFTER INSERT OR DELETE ON public.clinic_member_specialties
FOR EACH ROW EXECUTE FUNCTION public.sync_clinic_member_primary_specialty();

-- 4. Backfill: from existing clinic_members.specialty
INSERT INTO public.professional_specialties (user_id, specialty, is_primary)
SELECT DISTINCT ON (user_id, specialty) user_id, specialty, true
  FROM public.clinic_members
  WHERE specialty IS NOT NULL AND TRIM(specialty) <> ''
ON CONFLICT (user_id, specialty) DO NOTHING;

-- Mark only one is_primary per user (the earliest)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
    FROM public.professional_specialties
)
UPDATE public.professional_specialties ps
  SET is_primary = (r.rn = 1)
  FROM ranked r
  WHERE ps.id = r.id;

-- Backfill clinic_member_specialties (skip trigger via direct insert; trigger will run and re-set specialty to same value)
INSERT INTO public.clinic_member_specialties (clinic_member_id, specialty)
SELECT id, specialty FROM public.clinic_members
  WHERE specialty IS NOT NULL AND TRIM(specialty) <> ''
ON CONFLICT (clinic_member_id, specialty) DO NOTHING;
