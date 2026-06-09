-- Add FK from clinic_members.user_id to profiles.id so PostgREST can
-- embed profile data directly in the clinic_members query (used by marketplace).
-- NOT VALID skips retroactive validation of existing rows.
ALTER TABLE public.clinic_members
  ADD CONSTRAINT clinic_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
  NOT VALID;
