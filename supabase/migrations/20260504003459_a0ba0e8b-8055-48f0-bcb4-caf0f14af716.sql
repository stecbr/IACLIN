-- Sync cancellation: appointment -> appointment_request
CREATE OR REPLACE FUNCTION public.sync_request_on_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    UPDATE public.appointment_requests
      SET status = 'cancelled', updated_at = now()
      WHERE appointment_id = NEW.id
        AND status IN ('pending', 'approved');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_request_on_appointment_cancel ON public.appointments;
CREATE TRIGGER trg_sync_request_on_appointment_cancel
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_request_on_appointment_cancel();

-- Sync cancellation: appointment_request -> appointment
CREATE OR REPLACE FUNCTION public.sync_appointment_on_request_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND (OLD.status IS DISTINCT FROM 'cancelled')
     AND NEW.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
      SET status = 'cancelled', updated_at = now()
      WHERE id = NEW.appointment_id
        AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_on_request_cancel ON public.appointment_requests;
CREATE TRIGGER trg_sync_appointment_on_request_cancel
AFTER UPDATE OF status ON public.appointment_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_on_request_cancel();

-- Backfill: clean up any pre-existing inconsistencies so already-cancelled
-- appointments release their slots immediately.
UPDATE public.appointment_requests ar
  SET status = 'cancelled', updated_at = now()
  FROM public.appointments a
  WHERE ar.appointment_id = a.id
    AND a.status = 'cancelled'
    AND ar.status IN ('pending','approved');