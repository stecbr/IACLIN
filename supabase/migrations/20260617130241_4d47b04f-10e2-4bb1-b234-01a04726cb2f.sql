
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS max_professionals INTEGER,
  ADD COLUMN IF NOT EXISTS extra_professional_price_cents INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS platform_plans_segment_name_cycle_key
  ON public.platform_plans (segment, name, billing_cycle);

INSERT INTO public.platform_plans
  (name, description, segment, billing_cycle, price_cents, currency, features, is_active, sort_order, max_professionals, extra_professional_price_cents)
VALUES
  ('Essencial',  'Para clínicas pequenas começando a organizar a operação.', 'clinic', 'monthly',  59900, 'BRL',
   '["Agenda inteligente","Prontuário eletrônico","Financeiro básico","WhatsApp integrado","Marketplace","Suporte por e-mail"]'::jsonb,
   true, 10, 10, 10000),
  ('Plus',       'Para clínicas em crescimento com mais profissionais.',     'clinic', 'monthly',  84900, 'BRL',
   '["Tudo do Essencial","Régua de relacionamento","Funil de orçamentos","Relatórios avançados"]'::jsonb,
   true, 20, 15, 10000),
  ('Pro',        'Para clínicas consolidadas que precisam de mais escala.',  'clinic', 'monthly', 109900, 'BRL',
   '["Tudo do Plus","Campanhas em massa","Múltiplas unidades","Suporte prioritário"]'::jsonb,
   true, 30, 20, 10000),
  ('Avançado',   'Para redes com grande equipe clínica.',                     'clinic', 'monthly', 149900, 'BRL',
   '["Tudo do Pro","IA Gestor","Secretária IA WhatsApp","Integração com operadoras"]'::jsonb,
   true, 40, 30, 10000),
  ('Enterprise', 'Para grandes redes com 50+ profissionais.',                 'clinic', 'monthly', 219900, 'BRL',
   '["Tudo do Avançado","Onboarding dedicado","SLA personalizado","Gerente de conta"]'::jsonb,
   true, 50, 50, 10000)
ON CONFLICT (segment, name, billing_cycle) DO NOTHING;
