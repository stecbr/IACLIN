
DO $$
DECLARE
  mappings text[][] := ARRAY[
    ['Allianz Saúde','000515'],
    ['Amil','326305'],
    ['Bradesco Saúde','005711'],
    ['Care Plus','379956'],
    ['Cassi','346659'],
    ['Geap','323080'],
    ['Hapvida','368253'],
    ['Mediservice','333689'],
    ['MetLife Odonto','406481'],
    ['NotreDame Intermédica','359017'],
    ['OdontoPrev','301949'],
    ['Omint','359661'],
    ['Porto Dental','418625'],
    ['Porto Seguro Saúde','000582'],
    ['Prevent Senior','302147'],
    ['São Cristóvão Saúde','314218'],
    ['SulAmérica','006246']
  ];
  pair text[];
  orphan_id uuid;
  target_id uuid;
  target_name text;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY mappings LOOP
    SELECT id INTO orphan_id FROM public.insurance_operators WHERE name = pair[1] AND ans_code IS NULL LIMIT 1;
    SELECT id, name INTO target_id, target_name FROM public.insurance_operators WHERE ans_code = pair[2] LIMIT 1;
    IF orphan_id IS NULL OR target_id IS NULL THEN CONTINUE; END IF;

    -- insurance_plans
    UPDATE public.insurance_plans p SET operator_id = target_id
     WHERE p.operator_id = orphan_id
       AND NOT EXISTS (SELECT 1 FROM public.insurance_plans p2
                        WHERE p2.operator_id = target_id AND lower(p2.name) = lower(p.name));
    DELETE FROM public.insurance_plans WHERE operator_id = orphan_id;

    -- catálogo (chave única operator_name+plan_name)
    UPDATE public.insurance_plans_catalog c
       SET operator_id = target_id, operator_name = target_name
     WHERE c.operator_id = orphan_id
       AND NOT EXISTS (SELECT 1 FROM public.insurance_plans_catalog c2
                        WHERE c2.operator_name = target_name AND lower(c2.plan_name) = lower(c.plan_name));
    DELETE FROM public.insurance_plans_catalog WHERE operator_id = orphan_id;

    -- demais tabelas referenciadoras
    UPDATE public.operator_members SET operator_id = target_id WHERE operator_id = orphan_id;
    UPDATE public.operator_credentialings SET operator_id = target_id WHERE operator_id = orphan_id;
    UPDATE public.operator_price_tables SET operator_id = target_id WHERE operator_id = orphan_id;

    DELETE FROM public.insurance_operators WHERE id = orphan_id;
  END LOOP;
END$$;
