-- Tabela de configuração da Secretária IA por clínica
CREATE TABLE public.ai_secretary_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL UNIQUE,
  custom_prompt TEXT DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_secretary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view ai config"
  ON public.ai_secretary_config
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert ai config"
  ON public.ai_secretary_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update ai config"
  ON public.ai_secretary_config
  FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete ai config"
  ON public.ai_secretary_config
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_ai_secretary_config_updated_at
  BEFORE UPDATE ON public.ai_secretary_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_ai_secretary_config_clinic_id ON public.ai_secretary_config(clinic_id);