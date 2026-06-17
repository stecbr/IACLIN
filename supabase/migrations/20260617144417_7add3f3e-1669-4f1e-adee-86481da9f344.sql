ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auxiliary';

ALTER TABLE public.clinic_members
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;