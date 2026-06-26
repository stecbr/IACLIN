
ALTER TABLE public.treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_status_check;
ALTER TABLE public.treatment_plans ADD CONSTRAINT treatment_plans_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'awaiting_payment'::text, 'realized'::text, 'not_approved'::text, 'awaiting_clinic_approval'::text, 'rejected_by_clinic'::text]));

ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS payment_recorded_by UUID REFERENCES auth.users(id);
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS payment_notes TEXT;
