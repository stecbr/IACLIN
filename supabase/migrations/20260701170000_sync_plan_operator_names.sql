-- insurance_plans_catalog.operator_name é uma cópia desnormalizada do nome da
-- operadora no momento da importação. O refresh do catálogo de operadoras
-- (20260701140001) atualiza insurance_operators.name mas não propaga para os
-- planos já importados, deixando o nome exibido no seletor de convênios
-- desatualizado. Resincroniza a partir da fonte de verdade (operator_id).

UPDATE public.insurance_plans_catalog p
SET operator_name = o.name
FROM public.insurance_operators o
WHERE p.operator_id = o.id
  AND p.operator_name IS DISTINCT FROM o.name;
