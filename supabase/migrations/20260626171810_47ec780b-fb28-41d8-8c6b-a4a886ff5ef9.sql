ALTER TABLE public.treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_status_check;
UPDATE public.treatment_plans SET status = 'not_approved' WHERE status = 'lost';
ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_status_check
  CHECK (status IN ('pending', 'approved', 'realized', 'not_approved', 'awaiting_clinic_approval', 'rejected_by_clinic'));