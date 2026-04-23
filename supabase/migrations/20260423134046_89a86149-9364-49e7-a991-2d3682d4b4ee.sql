-- Add presence tracking columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS presence_status TEXT NOT NULL DEFAULT 'not_arrived',
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_started_at TIMESTAMPTZ;

-- Constraint to validate values
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_presence_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_presence_status_check
  CHECK (presence_status IN ('not_arrived', 'arrived', 'in_service', 'finished', 'no_show'));

-- Index for waiting room queries (today's appointments by clinic)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_start_presence
  ON public.appointments (clinic_id, start_time, presence_status);

-- Trigger function: keep presence_status in sync with status
CREATE OR REPLACE FUNCTION public.sync_appointment_presence_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed' AND NEW.presence_status <> 'finished' THEN
      NEW.presence_status := 'finished';
    ELSIF NEW.status = 'no_show' AND NEW.presence_status <> 'no_show' THEN
      NEW.presence_status := 'no_show';
    ELSIF NEW.status = 'cancelled' THEN
      -- keep as-is, but ensure not stuck on in_service
      IF NEW.presence_status = 'in_service' THEN
        NEW.presence_status := 'finished';
      END IF;
    END IF;
  END IF;

  -- Stamp timestamps when presence_status transitions
  IF TG_OP = 'UPDATE' AND OLD.presence_status IS DISTINCT FROM NEW.presence_status THEN
    IF NEW.presence_status = 'arrived' AND NEW.arrived_at IS NULL THEN
      NEW.arrived_at := now();
    ELSIF NEW.presence_status = 'in_service' AND NEW.service_started_at IS NULL THEN
      NEW.service_started_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_presence ON public.appointments;
CREATE TRIGGER trg_sync_appointment_presence
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_presence_status();

-- Enable realtime for appointments (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  END IF;
END $$;

ALTER TABLE public.appointments REPLICA IDENTITY FULL;