-- Templates de receituário (clinic-scoped)
CREATE TABLE public.prescription_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL,
  dentist_id UUID,
  name TEXT NOT NULL,
  category TEXT,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescription_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view prescription templates"
  ON public.prescription_templates FOR SELECT TO authenticated
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert prescription templates"
  ON public.prescription_templates FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update prescription templates"
  ON public.prescription_templates FOR UPDATE TO authenticated
  USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete prescription templates"
  ON public.prescription_templates FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_prescription_templates_updated_at
  BEFORE UPDATE ON public.prescription_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_prescription_templates_clinic ON public.prescription_templates(clinic_id);
CREATE INDEX idx_prescription_templates_dentist ON public.prescription_templates(dentist_id);

-- Assinatura digital escaneada do profissional
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Duração do procedimento gravada pelo Timer
ALTER TABLE public.clinical_records ADD COLUMN IF NOT EXISTS procedure_duration_seconds INTEGER;