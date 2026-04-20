CREATE TABLE public.ai_secretary_handoff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  target_user_id uuid,
  target_phone text,
  trigger_keywords text,
  handoff_message text DEFAULT 'Vou te transferir para um atendente humano. Aguarde um momento, por favor.',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_secretary_handoff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view handoff"
ON public.ai_secretary_handoff FOR SELECT TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert handoff"
ON public.ai_secretary_handoff FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update handoff"
ON public.ai_secretary_handoff FOR UPDATE TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete handoff"
ON public.ai_secretary_handoff FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ai_secretary_handoff_updated_at
BEFORE UPDATE ON public.ai_secretary_handoff
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();