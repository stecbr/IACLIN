CREATE OR REPLACE FUNCTION public.notify_credentialing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_operator_name text;
  v_member record;
  v_title text;
  v_message text;
BEGIN
  SELECT name INTO v_operator_name
  FROM public.insurance_operators
  WHERE id = NEW.operator_id;

  IF TG_OP = 'INSERT' THEN
    FOR v_member IN SELECT user_id FROM public.operator_members WHERE operator_id = NEW.operator_id LOOP
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (NULL, v_member.user_id, 'credentialing', 'Novo pedido de credenciamento',
        'Um profissional/clínica solicitou credenciamento.', NEW.id, 'operator_credentialing');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_title := CASE NEW.status
      WHEN 'approved' THEN 'Credenciamento aprovado'
      WHEN 'rejected' THEN 'Credenciamento recusado'
      WHEN 'revoked' THEN 'Credenciamento revogado'
      ELSE 'Credenciamento atualizado'
    END;
    v_message := 'Operadora ' || COALESCE(v_operator_name, '') || ': ' || NEW.status
      || CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' — ' || NEW.rejection_reason ELSE '' END;

    IF NEW.professional_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (NEW.clinic_id, NEW.professional_user_id, 'credentialing', v_title, v_message, NEW.id, 'operator_credentialing');
    ELSE
      FOR v_member IN
        SELECT user_id FROM public.clinic_members
        WHERE clinic_id = NEW.clinic_id
          AND role IN ('owner', 'admin')
          AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
        VALUES (NEW.clinic_id, v_member.user_id, 'credentialing', v_title, v_message, NEW.id, 'operator_credentialing');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;