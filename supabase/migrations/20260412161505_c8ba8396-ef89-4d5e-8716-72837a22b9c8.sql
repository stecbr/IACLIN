
-- 1. Create table FIRST
CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'dentist',
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, user_id)
);

ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- 2. Security definer functions (table now exists)
CREATE OR REPLACE FUNCTION public.is_clinic_owner(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id AND clinic_id = _clinic_id AND is_owner = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_member(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.clinic_members WHERE user_id = _user_id
$$;

-- 3. RLS policies
CREATE POLICY "Members can view own clinic members"
ON public.clinic_members FOR SELECT TO authenticated
USING (clinic_id IN (SELECT public.is_clinic_member(auth.uid())));

CREATE POLICY "Owners can insert clinic members"
ON public.clinic_members FOR INSERT TO authenticated
WITH CHECK (public.is_clinic_owner(auth.uid(), clinic_id));

CREATE POLICY "Owners can update clinic members"
ON public.clinic_members FOR UPDATE TO authenticated
USING (public.is_clinic_owner(auth.uid(), clinic_id));

CREATE POLICY "Owners can delete clinic members"
ON public.clinic_members FOR DELETE TO authenticated
USING (public.is_clinic_owner(auth.uid(), clinic_id));

-- 4. Auto-link owner trigger
CREATE OR REPLACE FUNCTION public.auto_link_clinic_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.clinic_members (clinic_id, user_id, role, is_owner)
    VALUES (NEW.id, NEW.owner_id, 'admin', true)
    ON CONFLICT (clinic_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_clinic_created_link_owner
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.auto_link_clinic_owner();
