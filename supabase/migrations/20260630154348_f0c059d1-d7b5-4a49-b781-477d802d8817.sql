
-- 1) Coluna operator_id em insurance_plans_catalog
ALTER TABLE public.insurance_plans_catalog
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.insurance_operators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_insurance_plans_catalog_operator_id
  ON public.insurance_plans_catalog(operator_id);

-- 2) Backfill operadoras a partir do catálogo
INSERT INTO public.insurance_operators (name, type, approval_status, is_active)
SELECT DISTINCT btrim(c.operator_name), 
       CASE WHEN c.type IN ('medico','odonto','ambos') THEN c.type ELSE 'ambos' END,
       'approved', true
FROM public.insurance_plans_catalog c
WHERE btrim(coalesce(c.operator_name,'')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.insurance_operators o
    WHERE lower(btrim(o.name)) = lower(btrim(c.operator_name))
  );

-- 3) Backfill operadoras a partir dos planos das clínicas (insurance_plans.name representa o nome do convênio,
--    mas vamos tratá-lo como operadora quando não há operator_id ligado)
INSERT INTO public.insurance_operators (name, type, approval_status, is_active)
SELECT DISTINCT btrim(p.name),
       CASE WHEN p.type IN ('medico','odonto','ambos') THEN p.type ELSE 'ambos' END,
       'approved', true
FROM public.insurance_plans p
WHERE p.operator_id IS NULL
  AND btrim(coalesce(p.name,'')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.insurance_operators o
    WHERE lower(btrim(o.name)) = lower(btrim(p.name))
  );

-- 4) Linka catálogo às operadoras por nome
UPDATE public.insurance_plans_catalog c
SET operator_id = o.id
FROM public.insurance_operators o
WHERE c.operator_id IS NULL
  AND lower(btrim(o.name)) = lower(btrim(c.operator_name));

-- 5) Linka planos de clínica às operadoras por nome
UPDATE public.insurance_plans p
SET operator_id = o.id
FROM public.insurance_operators o
WHERE p.operator_id IS NULL
  AND lower(btrim(o.name)) = lower(btrim(p.name));

-- 6) RPCs administrativas (Super Admin)
CREATE OR REPLACE FUNCTION public.admin_upsert_operator(payload jsonb)
RETURNS public.insurance_operators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row public.insurance_operators;
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_id := nullif(payload->>'id','')::uuid;

  IF v_id IS NULL THEN
    INSERT INTO public.insurance_operators (
      name, legal_name, cnpj, ans_code, type,
      contact_email, contact_phone, responsible_name,
      logo_url, brand_color, is_active, approval_status
    ) VALUES (
      payload->>'name',
      nullif(payload->>'legal_name',''),
      nullif(payload->>'cnpj',''),
      nullif(payload->>'ans_code',''),
      coalesce(nullif(payload->>'type',''),'ambos'),
      nullif(payload->>'contact_email',''),
      nullif(payload->>'contact_phone',''),
      nullif(payload->>'responsible_name',''),
      nullif(payload->>'logo_url',''),
      nullif(payload->>'brand_color',''),
      coalesce((payload->>'is_active')::boolean, true),
      'approved'
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.insurance_operators SET
      name = coalesce(payload->>'name', name),
      legal_name = nullif(payload->>'legal_name',''),
      cnpj = nullif(payload->>'cnpj',''),
      ans_code = nullif(payload->>'ans_code',''),
      type = coalesce(nullif(payload->>'type',''), type),
      contact_email = nullif(payload->>'contact_email',''),
      contact_phone = nullif(payload->>'contact_phone',''),
      responsible_name = nullif(payload->>'responsible_name',''),
      logo_url = nullif(payload->>'logo_url',''),
      brand_color = nullif(payload->>'brand_color',''),
      is_active = coalesce((payload->>'is_active')::boolean, is_active),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_operator(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.insurance_operators WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_operator_plans(p_operator_id uuid)
RETURNS SETOF public.insurance_plans_catalog
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT * FROM public.insurance_plans_catalog
  WHERE operator_id = p_operator_id
  ORDER BY plan_name;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_upsert_catalog_plan(payload jsonb)
RETURNS public.insurance_plans_catalog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_op_id uuid;
  v_op_name text;
  v_row public.insurance_plans_catalog;
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_id := nullif(payload->>'id','')::uuid;
  v_op_id := nullif(payload->>'operator_id','')::uuid;

  IF v_op_id IS NOT NULL THEN
    SELECT name INTO v_op_name FROM public.insurance_operators WHERE id = v_op_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.insurance_plans_catalog (
      operator_id, operator_name, plan_name, type, ans_code, is_active
    ) VALUES (
      v_op_id,
      coalesce(v_op_name, payload->>'operator_name'),
      payload->>'plan_name',
      coalesce(nullif(payload->>'type',''),'ambos'),
      nullif(payload->>'ans_code',''),
      coalesce((payload->>'is_active')::boolean, true)
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.insurance_plans_catalog SET
      operator_id = v_op_id,
      operator_name = coalesce(v_op_name, operator_name),
      plan_name = coalesce(payload->>'plan_name', plan_name),
      type = coalesce(nullif(payload->>'type',''), type),
      ans_code = nullif(payload->>'ans_code',''),
      is_active = coalesce((payload->>'is_active')::boolean, is_active)
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_catalog_plan(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.insurance_plans_catalog WHERE id = p_id;
END; $$;
