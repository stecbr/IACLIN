ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_cancelled_by
  ON public.appointments (clinic_id, cancelled_by)
  WHERE cancelled_by IS NOT NULL;