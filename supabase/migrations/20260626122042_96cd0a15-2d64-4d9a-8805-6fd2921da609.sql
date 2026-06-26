CREATE OR REPLACE FUNCTION public.sync_appointment_presence_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'completed'
       AND NEW.presence_status NOT IN ('finished','awaiting_payment') THEN
      NEW.presence_status := 'finished';
    ELSIF NEW.status = 'no_show' AND NEW.presence_status <> 'no_show' THEN
      NEW.presence_status := 'no_show';
    ELSIF NEW.status = 'cancelled' AND NEW.presence_status = 'in_service' THEN
      NEW.presence_status := 'finished';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.presence_status IS DISTINCT FROM NEW.presence_status THEN
    IF NEW.presence_status = 'arrived' AND NEW.arrived_at IS NULL THEN
      NEW.arrived_at := now();
    ELSIF NEW.presence_status = 'in_service' AND NEW.service_started_at IS NULL THEN
      NEW.service_started_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;