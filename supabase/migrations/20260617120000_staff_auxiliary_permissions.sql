-- Add auxiliary role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auxiliary';

-- Add permissions JSONB column to clinic_members
ALTER TABLE public.clinic_members
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;
