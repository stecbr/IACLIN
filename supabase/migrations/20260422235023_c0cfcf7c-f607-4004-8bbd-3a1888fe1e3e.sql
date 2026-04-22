-- Create appointment_requests table
CREATE TABLE public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  patient_account_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  clinic_id UUID NOT NULL,
  dentist_id UUID NOT NULL,
  specialty TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  appointment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_requests_clinic_status ON public.appointment_requests(clinic_id, status);
CREATE INDEX idx_appointment_requests_dentist ON public.appointment_requests(dentist_id);
CREATE INDEX idx_appointment_requests_patient ON public.appointment_requests(patient_user_id);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Patients can view own requests
CREATE POLICY "Patients can view own requests"
  ON public.appointment_requests FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

-- RLS: Patients can insert own requests
CREATE POLICY "Patients can insert own requests"
  ON public.appointment_requests FOR INSERT
  TO authenticated
  WITH CHECK (patient_user_id = auth.uid());

-- RLS: Patients can cancel own pending requests
CREATE POLICY "Patients can cancel own pending requests"
  ON public.appointment_requests FOR UPDATE
  TO authenticated
  USING (patient_user_id = auth.uid() AND status = 'pending');

-- RLS: Clinic members can view clinic requests
CREATE POLICY "Clinic members can view requests"
  ON public.appointment_requests FOR SELECT
  TO authenticated
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- RLS: Clinic members can update clinic requests
CREATE POLICY "Clinic members can update requests"
  ON public.appointment_requests FOR UPDATE
  TO authenticated
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

-- RLS: Dentist can view own requests
CREATE POLICY "Dentist can view own assigned requests"
  ON public.appointment_requests FOR SELECT
  TO authenticated
  USING (dentist_id = auth.uid());

-- Trigger: update updated_at
CREATE TRIGGER appointment_requests_updated_at
  BEFORE UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger function
CREATE OR REPLACE FUNCTION public.notify_appointment_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_name TEXT;
  v_patient_name TEXT;
  v_when TEXT;
  v_member RECORD;
BEGIN
  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = NEW.clinic_id;
  v_patient_name := COALESCE(NEW.patient_account_snapshot->>'full_name', 'paciente');
  v_when := to_char(NEW.start_time AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');

  IF TG_OP = 'INSERT' THEN
    -- Notify all clinic members (admins/secretaries)
    FOR v_member IN
      SELECT user_id FROM public.clinic_members
      WHERE clinic_id = NEW.clinic_id
        AND role IN ('admin', 'secretary')
    LOOP
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id,
        v_member.user_id,
        'appointment_request',
        'Novo pedido de consulta',
        'Pedido de ' || v_patient_name || ' para ' || v_when || '.',
        NEW.id,
        'appointment_request'
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      -- Notify dentist
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id,
        NEW.dentist_id,
        'appointment',
        'Nova consulta confirmada',
        'Consulta com ' || v_patient_name || ' confirmada para ' || v_when || '.',
        COALESCE(NEW.appointment_id, NEW.id),
        'appointment'
      );
      -- Notify patient
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id,
        NEW.patient_user_id,
        'appointment',
        'Sua consulta foi confirmada',
        'Sua consulta em ' || COALESCE(v_clinic_name, 'clínica') || ' foi confirmada para ' || v_when || '.',
        COALESCE(NEW.appointment_id, NEW.id),
        'appointment'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        NEW.clinic_id,
        NEW.patient_user_id,
        'appointment',
        'Pedido de consulta recusado',
        'Sua solicitação de consulta para ' || v_when || ' foi recusada.' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' Motivo: ' || NEW.rejection_reason ELSE '' END,
        NEW.id,
        'appointment_request'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_requests_notify
  AFTER INSERT OR UPDATE ON public.appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_request_change();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_requests;
ALTER TABLE public.appointment_requests REPLICA IDENTITY FULL;