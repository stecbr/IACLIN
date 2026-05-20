
ALTER TABLE public.treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_status_check;

UPDATE public.treatment_plans SET status = 'negotiating' WHERE status = 'in_progress';
UPDATE public.treatment_plans SET status = 'approved' WHERE status = 'completed';
UPDATE public.treatment_plans SET status = 'lost' WHERE status = 'cancelled';

ALTER TABLE public.treatment_plans
  ADD CONSTRAINT treatment_plans_status_check
  CHECK (status IN ('pending', 'negotiating', 'approved', 'lost'));
