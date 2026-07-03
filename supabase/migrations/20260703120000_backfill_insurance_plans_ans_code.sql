-- O cadastro de convênio da clínica (InsurancePlansSection) preenchia o
-- ans_code buscando o catálogo inteiro no cliente sem paginação, o que
-- estourava o limite padrão de 1000 linhas do Supabase: planos "fora dos
-- primeiros 1000" nunca eram encontrados e ficavam salvos com ans_code NULL.
-- Isso quebra o match paciente↔clínica no agendamento (que exige nome + ans_code
-- idênticos), fazendo a clínica não aparecer mesmo aceitando o plano.
-- Backfill: para planos com ans_code NULL que têm exatamente um correspondente
-- no catálogo por nome normalizado, copia o ans_code de lá.
WITH catalog_norm AS (
  SELECT DISTINCT lower(btrim(plan_name)) AS norm_name, ans_code
  FROM public.insurance_plans_catalog
  WHERE is_active = true
    AND ans_code IS NOT NULL
),
unique_matches AS (
  SELECT norm_name, min(ans_code) AS ans_code
  FROM catalog_norm
  GROUP BY norm_name
  HAVING count(*) = 1
)
UPDATE public.insurance_plans p
SET ans_code = u.ans_code
FROM unique_matches u
WHERE p.ans_code IS NULL
  AND lower(btrim(p.name)) = u.norm_name;
