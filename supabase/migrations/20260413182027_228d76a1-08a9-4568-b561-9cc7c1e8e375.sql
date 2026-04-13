-- Create enum for clinic categories
CREATE TYPE public.clinic_category AS ENUM ('odonto', 'medico', 'estetica', 'veterinario', 'outro');

-- Add category column to clinics table
ALTER TABLE public.clinics ADD COLUMN category public.clinic_category NOT NULL DEFAULT 'odonto';