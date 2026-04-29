-- Seed procedure catalogs for medical, nutrition, physio and podology families
INSERT INTO public.procedures (name, category, specialty_category, default_price, default_duration, color, is_active) VALUES
-- Medical (clínico)
('Consulta clínica', 'consulta', 'medico', 250, 30, '#3B82F6', true),
('Retorno', 'consulta', 'medico', 120, 20, '#60A5FA', true),
('Avaliação pré-operatória', 'avaliacao', 'medico', 350, 45, '#8B5CF6', true),
('Renovação de receita', 'consulta', 'medico', 80, 15, '#06B6D4', true),
('Solicitação de exames', 'consulta', 'medico', 100, 15, '#10B981', true),
('Pequena cirurgia ambulatorial', 'procedimento', 'medico', 800, 60, '#EF4444', true),
('Aferição de PA + ECG', 'exame', 'medico', 150, 20, '#F59E0B', true),
-- Nutrition
('Consulta nutricional inicial', 'consulta', 'nutricao', 200, 60, '#22C55E', true),
('Retorno nutricional', 'consulta', 'nutricao', 120, 30, '#16A34A', true),
('Avaliação antropométrica', 'avaliacao', 'nutricao', 150, 45, '#84CC16', true),
('Bioimpedância', 'exame', 'nutricao', 180, 30, '#10B981', true),
('Plano alimentar personalizado', 'procedimento', 'nutricao', 250, 45, '#059669', true),
('Recordatório 24h', 'avaliacao', 'nutricao', 100, 30, '#65A30D', true),
-- Physio
('Avaliação fisioterapêutica', 'avaliacao', 'fisio', 180, 60, '#0EA5E9', true),
('Sessão de fisioterapia', 'procedimento', 'fisio', 100, 50, '#06B6D4', true),
('RPG (Reeducação Postural Global)', 'procedimento', 'fisio', 150, 60, '#0891B2', true),
('Pilates clínico', 'procedimento', 'fisio', 120, 50, '#0E7490', true),
('Pacote 10 sessões', 'procedimento', 'fisio', 900, 50, '#155E75', true),
('Reabilitação pós-cirúrgica', 'procedimento', 'fisio', 130, 60, '#1E40AF', true),
-- Podology
('Atendimento podológico', 'procedimento', 'podologia', 120, 60, '#14B8A6', true),
('Tratamento de unha encravada', 'procedimento', 'podologia', 150, 45, '#0D9488', true),
('Remoção de calos e calosidades', 'procedimento', 'podologia', 100, 40, '#0F766E', true),
('Curativo especializado', 'procedimento', 'podologia', 90, 30, '#115E59', true),
('Avaliação do pé diabético', 'avaliacao', 'podologia', 180, 45, '#F97316', true),
('Tratamento de micose', 'procedimento', 'podologia', 110, 40, '#EA580C', true)
ON CONFLICT DO NOTHING;