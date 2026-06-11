
-- 1. Tabela clinic_member_procedures
CREATE TABLE public.clinic_member_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_member_id uuid NOT NULL REFERENCES public.clinic_members(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  custom_duration integer,
  custom_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_member_id, procedure_id)
);

CREATE INDEX idx_cmp_member ON public.clinic_member_procedures(clinic_member_id);
CREATE INDEX idx_cmp_procedure ON public.clinic_member_procedures(procedure_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_member_procedures TO authenticated;
GRANT SELECT ON public.clinic_member_procedures TO anon;
GRANT ALL ON public.clinic_member_procedures TO service_role;

ALTER TABLE public.clinic_member_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can view member procedures"
  ON public.clinic_member_procedures FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can view member procedures"
  ON public.clinic_member_procedures FOR SELECT TO authenticated USING (true);

CREATE POLICY "Self/owner/admin can insert member procedures"
  ON public.clinic_member_procedures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = clinic_member_procedures.clinic_member_id
      AND (cm.user_id = auth.uid()
           OR public.is_clinic_owner(auth.uid(), cm.clinic_id)
           OR (public.has_role(auth.uid(), 'admin'::app_role)
               AND public.user_belongs_to_clinic(auth.uid(), cm.clinic_id)))
  ));

CREATE POLICY "Self/owner/admin can update member procedures"
  ON public.clinic_member_procedures FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = clinic_member_procedures.clinic_member_id
      AND (cm.user_id = auth.uid()
           OR public.is_clinic_owner(auth.uid(), cm.clinic_id)
           OR (public.has_role(auth.uid(), 'admin'::app_role)
               AND public.user_belongs_to_clinic(auth.uid(), cm.clinic_id)))
  ));

CREATE POLICY "Self/owner/admin can delete member procedures"
  ON public.clinic_member_procedures FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = clinic_member_procedures.clinic_member_id
      AND (cm.user_id = auth.uid()
           OR public.is_clinic_owner(auth.uid(), cm.clinic_id)
           OR (public.has_role(auth.uid(), 'admin'::app_role)
               AND public.user_belongs_to_clinic(auth.uid(), cm.clinic_id)))
  ));

CREATE TRIGGER trg_cmp_updated_at
  BEFORE UPDATE ON public.clinic_member_procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Approval mode no clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS appointment_approval_mode text NOT NULL DEFAULT 'clinic'
    CHECK (appointment_approval_mode IN ('clinic', 'professional'));

-- 3. Atualiza trigger de notificação para respeitar approval_mode
CREATE OR REPLACE FUNCTION public.notify_appointment_request_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clinic_name TEXT;
  v_patient_name TEXT;
  v_when TEXT;
  v_member RECORD;
  v_mode TEXT;
BEGIN
  SELECT name, COALESCE(appointment_approval_mode, 'clinic')
    INTO v_clinic_name, v_mode
    FROM public.clinics WHERE id = NEW.clinic_id;
  v_patient_name := COALESCE(NEW.patient_account_snapshot->>'full_name', 'paciente');
  v_when := to_char(NEW.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  IF TG_OP = 'INSERT' THEN
    IF v_mode = 'professional' AND NEW.dentist_id IS NOT NULL THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id, NEW.dentist_id, 'appointment_request',
        'Novo pedido de consulta',
        'Pedido de ' || v_patient_name || ' para ' || v_when || '.',
        NEW.id, 'appointment_request'
      );
    ELSE
      FOR v_member IN
        SELECT user_id FROM public.clinic_members
        WHERE clinic_id = NEW.clinic_id AND role IN ('admin', 'secretary')
      LOOP
        INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
        VALUES (
          NEW.clinic_id, v_member.user_id, 'appointment_request',
          'Novo pedido de consulta',
          'Pedido de ' || v_patient_name || ' para ' || v_when || '.',
          NEW.id, 'appointment_request'
        );
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id, NEW.dentist_id, 'appointment',
        'Nova consulta confirmada',
        'Consulta com ' || v_patient_name || ' confirmada para ' || v_when || '.',
        COALESCE(NEW.appointment_id, NEW.id), 'appointment'
      );
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id, NEW.patient_user_id, 'appointment',
        'Sua consulta foi confirmada',
        'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' foi confirmada para ' || v_when || '.',
        COALESCE(NEW.appointment_id, NEW.id), 'appointment'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id, NEW.patient_user_id, 'appointment',
        'Pedido de consulta recusado',
        'Sua solicitação de consulta para ' || v_when || ' foi recusada.' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' Motivo: ' || NEW.rejection_reason ELSE '' END,
        NEW.id, 'appointment_request'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
