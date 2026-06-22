-- Add missing foreign key constraints to appointment_requests
-- This allows PostgREST to perform embedded resource joins (clinics(name), profiles(full_name))

ALTER TABLE public.appointment_requests
  ADD CONSTRAINT appointment_requests_clinic_id_fkey
  FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE;

ALTER TABLE public.appointment_requests
  ADD CONSTRAINT appointment_requests_dentist_id_fkey
  FOREIGN KEY (dentist_id) REFERENCES auth.users(id) ON DELETE CASCADE;
