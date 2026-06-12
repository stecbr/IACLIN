ALTER TABLE public.ai_appointment_requests
  ADD COLUMN IF NOT EXISTS suggested_dentist_id uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.notify_ai_appointment_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_member RECORD;
  v_when text;
  v_patient text;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;

  SELECT COALESCE(appointment_approval_mode, 'clinic') INTO v_mode
    FROM public.clinics WHERE id = NEW.clinic_id;

  v_patient := COALESCE(NEW.patient_name, 'Paciente WhatsApp');
  v_when := to_char(NEW.requested_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  IF v_mode = 'professional' AND NEW.suggested_dentist_id IS NOT NULL THEN
    INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NEW.clinic_id, NEW.suggested_dentist_id, 'appointment_request',
      'Novo pedido (IA WhatsApp)',
      'Pedido de ' || v_patient || ' para ' || v_when ||
        CASE WHEN NEW.procedure IS NOT NULL THEN ' — ' || NEW.procedure ELSE '' END || '.',
      NEW.id, 'ai_appointment_request'
    );
  ELSE
    FOR v_member IN
      SELECT user_id FROM public.clinic_members
      WHERE clinic_id = NEW.clinic_id AND role IN ('admin', 'secretary')
    LOOP
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id, v_member.user_id, 'appointment_request',
        'Novo pedido (IA WhatsApp)',
        'Pedido de ' || v_patient || ' para ' || v_when ||
          CASE WHEN NEW.procedure IS NOT NULL THEN ' — ' || NEW.procedure ELSE '' END || '.',
        NEW.id, 'ai_appointment_request'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ai_appointment_request ON public.ai_appointment_requests;
CREATE TRIGGER trg_notify_ai_appointment_request
AFTER INSERT ON public.ai_appointment_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_ai_appointment_request();