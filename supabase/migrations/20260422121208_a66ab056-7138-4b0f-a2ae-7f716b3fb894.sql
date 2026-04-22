-- 1. Add invite_code to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 2. Function to generate clinic invite codes (CLIN-XXXXXXXX format, no confusing chars)
CREATE OR REPLACE FUNCTION public.generate_clinic_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'CLIN-';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 3. Trigger to auto-generate invite_code on clinic insert
CREATE OR REPLACE FUNCTION public.set_clinic_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.invite_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    new_code := public.generate_clinic_invite_code();
    attempts := attempts + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clinics WHERE invite_code = new_code);
    IF attempts > 10 THEN RAISE EXCEPTION 'Could not generate unique clinic invite_code'; END IF;
  END LOOP;
  NEW.invite_code := new_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_set_invite_code ON public.clinics;
CREATE TRIGGER clinics_set_invite_code
  BEFORE INSERT ON public.clinics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_clinic_invite_code();

-- 4. Backfill invite_code for existing clinics
DO $$
DECLARE
  c RECORD;
  new_code TEXT;
  attempts INT;
BEGIN
  FOR c IN SELECT id FROM public.clinics WHERE invite_code IS NULL LOOP
    attempts := 0;
    LOOP
      new_code := public.generate_clinic_invite_code();
      attempts := attempts + 1;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clinics WHERE invite_code = new_code);
      IF attempts > 10 THEN EXIT; END IF;
    END LOOP;
    UPDATE public.clinics SET invite_code = new_code WHERE id = c.id;
  END LOOP;
END $$;

-- 5. Ensure UNIQUE(clinic_id, user_id) on clinic_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinic_members_clinic_user_unique'
  ) THEN
    ALTER TABLE public.clinic_members
      ADD CONSTRAINT clinic_members_clinic_user_unique UNIQUE (clinic_id, user_id);
  END IF;
END $$;

-- 6. New table clinic_invites
CREATE TABLE IF NOT EXISTS public.clinic_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  specialty TEXT,
  registration_number TEXT,
  role public.app_role NOT NULL DEFAULT 'dentist',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinic_invites_clinic ON public.clinic_invites(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_invites_token ON public.clinic_invites(token);
CREATE INDEX IF NOT EXISTS idx_clinic_invites_email ON public.clinic_invites(lower(email));

ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;

-- Clinic members can view invites of their clinic
CREATE POLICY "Clinic members can view invites"
  ON public.clinic_invites FOR SELECT
  TO authenticated
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- Anyone authenticated can read a single invite by token (used during accept flow)
CREATE POLICY "Anyone authenticated can read by token"
  ON public.clinic_invites FOR SELECT
  TO authenticated
  USING (true);

-- Owners and admins of the clinic can insert invites
CREATE POLICY "Clinic owners/admins can create invites"
  ON public.clinic_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

-- Owners and admins can update (revoke / resend) invites
CREATE POLICY "Clinic owners/admins can update invites"
  ON public.clinic_invites FOR UPDATE
  TO authenticated
  USING (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

-- Owners and admins can delete invites
CREATE POLICY "Clinic owners/admins can delete invites"
  ON public.clinic_invites FOR DELETE
  TO authenticated
  USING (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

-- 7. Update clinic_members policies to allow admins (not just owners)
DROP POLICY IF EXISTS "Owners can insert clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Owners can update clinic members" ON public.clinic_members;
DROP POLICY IF EXISTS "Owners can delete clinic members" ON public.clinic_members;

CREATE POLICY "Owners and admins can insert clinic members"
  ON public.clinic_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

CREATE POLICY "Owners and admins can update clinic members"
  ON public.clinic_members FOR UPDATE
  TO authenticated
  USING (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

CREATE POLICY "Owners and admins can delete clinic members"
  ON public.clinic_members FOR DELETE
  TO authenticated
  USING (
    is_clinic_owner(auth.uid(), clinic_id)
    OR (has_role(auth.uid(), 'admin'::app_role) AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

-- 8. Updated_at trigger for clinic_invites (uses existing update_updated_at_column? No, table has no updated_at col; skip)