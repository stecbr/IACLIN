-- Importação em massa dos planos ativos da ANS vinculados às operadoras já cadastradas
-- Fonte: pda-008 Características dos Produtos da Saúde Suplementar (ANS Dados Abertos)
-- 27918 planos com situação 'Ativo', vinculados por REGISTRO_OPERADORA -> insurance_operators.ans_code

-- 1) Novas colunas com os campos do dataset da ANS
ALTER TABLE public.insurance_plans_catalog
  ADD COLUMN IF NOT EXISTS ans_plan_id bigint,
  ADD COLUMN IF NOT EXISTS vigencia text,
  ADD COLUMN IF NOT EXISTS contratacao text,
  ADD COLUMN IF NOT EXISTS gr_contratacao text,
  ADD COLUMN IF NOT EXISTS segmentacao_assistencial text,
  ADD COLUMN IF NOT EXISTS gr_segmentacao_assistencial text,
  ADD COLUMN IF NOT EXISTS has_odontologico boolean,
  ADD COLUMN IF NOT EXISTS obstetricia text,
  ADD COLUMN IF NOT EXISTS cobertura text,
  ADD COLUMN IF NOT EXISTS tipo_financiamento text,
  ADD COLUMN IF NOT EXISTS abrangencia_cobertura text,
  ADD COLUMN IF NOT EXISTS fator_moderador text,
  ADD COLUMN IF NOT EXISTS acomodacao_hospitalar text,
  ADD COLUMN IF NOT EXISTS livre_escolha text,
  ADD COLUMN IF NOT EXISTS situacao_plano text,
  ADD COLUMN IF NOT EXISTS dt_situacao date,
  ADD COLUMN IF NOT EXISTS dt_registro_plano date,
  ADD COLUMN IF NOT EXISTS porte_operadora text;

-- 2) ID_PLANO da ANS é a chave primária real do plano (única globalmente);
--    troca a unicidade por (operator_name, plan_name), que não se sustenta com nomes
--    comerciais repetidos entre variantes do mesmo produto.
ALTER TABLE public.insurance_plans_catalog
  DROP CONSTRAINT IF EXISTS insurance_plans_catalog_operator_name_plan_name_key;
DROP INDEX IF EXISTS public.insurance_plans_catalog_ans_plan_id_key;
ALTER TABLE public.insurance_plans_catalog
  ADD CONSTRAINT insurance_plans_catalog_ans_plan_id_key UNIQUE (ans_plan_id);
