-- Add specialty_category to procedures
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS specialty_category text NOT NULL DEFAULT 'odonto';

-- Helpful index for filtering by specialty
CREATE INDEX IF NOT EXISTS idx_procedures_specialty_category
  ON public.procedures (specialty_category) WHERE is_active = true;

-- Backfill: anything existing today is odonto (already default, but explicit for safety)
UPDATE public.procedures SET specialty_category = 'odonto' WHERE specialty_category IS NULL;

-- Seed aesthetic / plastic-surgery catalog (idempotent on name+category)
INSERT INTO public.procedures (name, category, description, default_duration, default_price, color, is_active, specialty_category)
SELECT * FROM (VALUES
  ('Avaliação Estética', 'Avaliação', 'Consulta inicial de avaliação estética', 40, 0, '#8B5CF6', true, 'estetica'),
  ('Aplicação de Toxina Botulínica', 'Estética', 'Aplicação de toxina botulínica em regiões faciais', 30, 0, '#EC4899', true, 'estetica'),
  ('Preenchimento com Ácido Hialurônico', 'Estética', 'Preenchimento facial com ácido hialurônico', 45, 0, '#F59E0B', true, 'estetica'),
  ('Bioestimulador de Colágeno', 'Estética', 'Aplicação de bioestimulador de colágeno', 45, 0, '#06B6D4', true, 'estetica'),
  ('Peeling Químico', 'Estética', 'Peeling químico facial', 40, 0, '#10B981', true, 'estetica'),
  ('Rinoplastia (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de rinoplastia', 40, 0, '#3B82F6', true, 'estetica'),
  ('Mamoplastia (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de mamoplastia', 40, 0, '#3B82F6', true, 'estetica'),
  ('Lipoaspiração (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de lipoaspiração', 40, 0, '#3B82F6', true, 'estetica'),
  ('Abdominoplastia (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de abdominoplastia', 40, 0, '#3B82F6', true, 'estetica'),
  ('Blefaroplastia (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de blefaroplastia', 40, 0, '#3B82F6', true, 'estetica'),
  ('Otoplastia (Avaliação)', 'Cirurgia', 'Avaliação pré-operatória de otoplastia', 40, 0, '#3B82F6', true, 'estetica'),
  ('Curativo / Retirada de Pontos', 'Pós-operatório', 'Curativo ou retirada de pontos', 20, 0, '#22C55E', true, 'estetica'),
  ('Sessão de Pós-operatório', 'Pós-operatório', 'Acompanhamento pós-operatório', 30, 0, '#22C55E', true, 'estetica')
) AS v(name, category, description, default_duration, default_price, color, is_active, specialty_category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.procedures p
  WHERE p.name = v.name AND p.specialty_category = v.specialty_category
);