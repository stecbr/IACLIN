
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  reference_id UUID,
  reference_type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: users can see notifications for their clinics
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id)));

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: auto-create notification on new appointment
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  patient_name TEXT;
BEGIN
  SELECT full_name INTO patient_name FROM public.patients WHERE id = NEW.patient_id;
  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    NEW.clinic_id,
    NEW.dentist_id,
    'appointment',
    'Nova consulta agendada',
    'Consulta com ' || COALESCE(patient_name, 'paciente') || ' foi agendada.',
    NEW.id,
    'appointment'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_appointment();

-- Trigger: auto-create notification on new financial transaction
CREATE OR REPLACE FUNCTION public.notify_new_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    NEW.clinic_id,
    COALESCE(NEW.dentist_id, '00000000-0000-0000-0000-000000000000'),
    'financial',
    CASE WHEN NEW.type = 'income' THEN 'Pagamento registrado' ELSE 'Despesa registrada' END,
    COALESCE(NEW.description, NEW.category) || ' - R$ ' || NEW.amount::TEXT,
    NEW.id,
    'financial_transaction'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_transaction
AFTER INSERT ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_transaction();

-- Index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_clinic_id ON public.notifications(clinic_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
