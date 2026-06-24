
-- Catálogo global de convênios (planos)
CREATE TABLE public.insurance_plans_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_name text NOT NULL,
  plan_name text NOT NULL,
  type text NOT NULL DEFAULT 'ambos' CHECK (type IN ('medico','odonto','ambos')),
  ans_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_name, plan_name)
);

GRANT SELECT ON public.insurance_plans_catalog TO anon, authenticated;
GRANT ALL ON public.insurance_plans_catalog TO service_role;

ALTER TABLE public.insurance_plans_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans catalog"
  ON public.insurance_plans_catalog FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Seed (planos populares no Brasil)
INSERT INTO public.insurance_plans_catalog (operator_name, plan_name, type) VALUES
  ('Unimed', 'Unimed Nacional', 'medico'),
  ('Unimed', 'Unimed Estadual', 'medico'),
  ('Unimed', 'Unimed Personal', 'medico'),
  ('Unimed', 'Unimed Alfa', 'medico'),
  ('Unimed', 'Unimed Beta', 'medico'),
  ('Amil', 'Amil 400', 'medico'),
  ('Amil', 'Amil 500', 'medico'),
  ('Amil', 'Amil 700', 'medico'),
  ('Amil', 'Amil One', 'medico'),
  ('Amil', 'Amil Fácil', 'medico'),
  ('Amil Dental', 'Amil Dental 100', 'odonto'),
  ('Amil Dental', 'Amil Dental 200', 'odonto'),
  ('Bradesco Saúde', 'Bradesco Top Nacional', 'medico'),
  ('Bradesco Saúde', 'Bradesco Efetivo', 'medico'),
  ('Bradesco Saúde', 'Bradesco Preferencial', 'medico'),
  ('Bradesco Saúde', 'Bradesco Nacional Flex', 'medico'),
  ('Bradesco Dental', 'Bradesco Dental Plus', 'odonto'),
  ('SulAmérica', 'SulAmérica Clássico', 'medico'),
  ('SulAmérica', 'SulAmérica Especial', 'medico'),
  ('SulAmérica', 'SulAmérica Executivo', 'medico'),
  ('SulAmérica', 'SulAmérica Prestige', 'medico'),
  ('SulAmérica Odonto', 'SulAmérica Odonto Plus', 'odonto'),
  ('NotreDame Intermédica', 'GNDI Smart', 'medico'),
  ('NotreDame Intermédica', 'GNDI Advance', 'medico'),
  ('NotreDame Intermédica', 'GNDI Premium', 'medico'),
  ('Hapvida', 'Hapvida Mix', 'medico'),
  ('Hapvida', 'Hapvida Pleno', 'medico'),
  ('Hapvida', 'Hapvida Plus', 'medico'),
  ('Porto Seguro Saúde', 'Porto Bronze', 'medico'),
  ('Porto Seguro Saúde', 'Porto Prata', 'medico'),
  ('Porto Seguro Saúde', 'Porto Ouro', 'medico'),
  ('Porto Dental', 'Porto Dental Ideal', 'odonto'),
  ('Allianz Saúde', 'Allianz Standard', 'medico'),
  ('Allianz Saúde', 'Allianz Premium', 'medico'),
  ('Golden Cross', 'Golden Cross Empresarial', 'medico'),
  ('Golden Cross', 'Golden Cross Familiar', 'medico'),
  ('OdontoPrev', 'OdontoPrev Básico', 'odonto'),
  ('OdontoPrev', 'OdontoPrev Pleno', 'odonto'),
  ('OdontoPrev', 'OdontoPrev Premium', 'odonto'),
  ('Interodonto', 'Interodonto Plus', 'odonto'),
  ('MetLife Odonto', 'MetLife Dental Smart', 'odonto'),
  ('Care Plus', 'Care Plus Master', 'medico'),
  ('Omint', 'Omint Blue', 'medico'),
  ('Omint', 'Omint Gold', 'medico'),
  ('São Cristóvão Saúde', 'São Cristóvão Premium', 'medico'),
  ('Prevent Senior', 'Prevent Senior Total', 'medico'),
  ('Prevent Senior', 'Prevent Senior Smart', 'medico'),
  ('Cassi', 'Cassi Família', 'medico'),
  ('Geap', 'Geap Saúde', 'medico'),
  ('Mediservice', 'Mediservice Nacional', 'medico')
ON CONFLICT DO NOTHING;

-- Campo "convênio (plano)" separado da operadora
ALTER TABLE public.patient_accounts
  ADD COLUMN IF NOT EXISTS insurance_plan text;

ALTER TABLE public.patient_dependents_insurance
  ADD COLUMN IF NOT EXISTS insurance_plan text;
