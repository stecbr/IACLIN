-- admin_upsert_catalog_plan não salvava os campos ANS adicionados na importação
-- (vigencia, contratacao, cobertura, etc.) — o formulário de edição/criação de
-- plano no super admin agora envia esses campos, mas eram descartados no upsert.

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
      operator_id, operator_name, plan_name, type, ans_code, is_active,
      vigencia, contratacao, segmentacao_assistencial, cobertura,
      tipo_financiamento, abrangencia_cobertura, fator_moderador,
      acomodacao_hospitalar, livre_escolha, obstetricia, has_odontologico,
      situacao_plano, porte_operadora, dt_situacao, dt_registro_plano
    ) VALUES (
      v_op_id,
      coalesce(v_op_name, payload->>'operator_name'),
      payload->>'plan_name',
      coalesce(nullif(payload->>'type',''),'ambos'),
      nullif(payload->>'ans_code',''),
      coalesce((payload->>'is_active')::boolean, true),
      nullif(payload->>'vigencia',''),
      nullif(payload->>'contratacao',''),
      nullif(payload->>'segmentacao_assistencial',''),
      nullif(payload->>'cobertura',''),
      nullif(payload->>'tipo_financiamento',''),
      nullif(payload->>'abrangencia_cobertura',''),
      nullif(payload->>'fator_moderador',''),
      nullif(payload->>'acomodacao_hospitalar',''),
      nullif(payload->>'livre_escolha',''),
      nullif(payload->>'obstetricia',''),
      coalesce((payload->>'has_odontologico')::boolean, false),
      nullif(payload->>'situacao_plano',''),
      nullif(payload->>'porte_operadora',''),
      nullif(payload->>'dt_situacao','')::date,
      nullif(payload->>'dt_registro_plano','')::date
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.insurance_plans_catalog SET
      operator_id = v_op_id,
      operator_name = coalesce(v_op_name, operator_name),
      plan_name = coalesce(payload->>'plan_name', plan_name),
      type = coalesce(nullif(payload->>'type',''), type),
      ans_code = nullif(payload->>'ans_code',''),
      is_active = coalesce((payload->>'is_active')::boolean, is_active),
      vigencia = nullif(payload->>'vigencia',''),
      contratacao = nullif(payload->>'contratacao',''),
      segmentacao_assistencial = nullif(payload->>'segmentacao_assistencial',''),
      cobertura = nullif(payload->>'cobertura',''),
      tipo_financiamento = nullif(payload->>'tipo_financiamento',''),
      abrangencia_cobertura = nullif(payload->>'abrangencia_cobertura',''),
      fator_moderador = nullif(payload->>'fator_moderador',''),
      acomodacao_hospitalar = nullif(payload->>'acomodacao_hospitalar',''),
      livre_escolha = nullif(payload->>'livre_escolha',''),
      obstetricia = nullif(payload->>'obstetricia',''),
      has_odontologico = coalesce((payload->>'has_odontologico')::boolean, has_odontologico),
      situacao_plano = nullif(payload->>'situacao_plano',''),
      porte_operadora = nullif(payload->>'porte_operadora',''),
      dt_situacao = nullif(payload->>'dt_situacao','')::date,
      dt_registro_plano = nullif(payload->>'dt_registro_plano','')::date
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END; $$;
