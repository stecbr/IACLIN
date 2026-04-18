-- Enable realtime for notifications and appointments
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Trigger: notify patient when appointment status changes or is created
CREATE OR REPLACE FUNCTION public.notify_patient_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patient_user_id uuid;
  v_clinic_name text;
  v_title text;
  v_message text;
  v_when text;
BEGIN
  SELECT p.patient_user_id INTO v_patient_user_id
    FROM public.patients p
    WHERE p.id = NEW.patient_id;

  IF v_patient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.name INTO v_clinic_name FROM public.clinics c WHERE c.id = NEW.clinic_id;
  v_when := to_char(NEW.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  IF TG_OP = 'INSERT' THEN
    v_title := 'Nova consulta agendada';
    v_message := 'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' foi marcada para ' || v_when || '.';
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        v_title := 'Consulta confirmada';
        v_message := 'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' (' || v_when || ') foi confirmada.';
      WHEN 'cancelled' THEN
        v_title := 'Consulta cancelada';
        v_message := 'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' (' || v_when || ') foi cancelada.';
      WHEN 'completed' THEN
        v_title := 'Consulta realizada';
        v_message := 'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' foi finalizada.';
      WHEN 'no_show' THEN
        v_title := 'Falta registrada';
        v_message := 'Você foi marcado como ausente na consulta de ' || v_when || '.';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (NEW.clinic_id, v_patient_user_id, 'appointment', v_title, v_message, NEW.id, 'appointment');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_appointment_insert ON public.appointments;
CREATE TRIGGER trg_notify_patient_appointment_insert
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_appointment_change();

DROP TRIGGER IF EXISTS trg_notify_patient_appointment_update ON public.appointments;
CREATE TRIGGER trg_notify_patient_appointment_update
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_appointment_change();