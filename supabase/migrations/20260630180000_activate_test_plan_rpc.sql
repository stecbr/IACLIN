-- RPC segura para ativar planos de teste sem exigir platform_admin.
-- Valida que o plano é de teste (nome ILIKE '%teste%') e que o caller
-- é o próprio usuário (entity_type=doctor) ou membro da clínica (entity_type=clinic).

CREATE OR REPLACE FUNCTION public.activate_test_plan(
  p_entity_type text,        -- 'doctor' | 'clinic'
  p_entity_id   uuid,
  p_plan_id     uuid,
  p_current_period_end timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_name  text;
  v_is_test    boolean := false;
  v_authorized boolean := false;
BEGIN
  -- 1. Verifica que o plano existe e é um plano de teste
  SELECT name, (name ILIKE '%teste%')
  INTO   v_plan_name, v_is_test
  FROM   public.platform_plans
  WHERE  id = p_plan_id AND is_active = true;

  IF v_plan_name IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  IF NOT v_is_test THEN
    RAISE EXCEPTION 'Esta função só pode ativar planos de teste';
  END IF;

  -- 2. Verifica que o caller tem permissão sobre o entity_id
  IF p_entity_type = 'doctor' THEN
    v_authorized := (p_entity_id = auth.uid());

  ELSIF p_entity_type = 'clinic' THEN
    SELECT EXISTS (
      SELECT 1
      FROM   public.clinic_members
      WHERE  clinic_id = p_entity_id
        AND  user_id   = auth.uid()
    ) INTO v_authorized;

  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Não autorizado para esta entidade';
  END IF;

  -- 3. Upsert da assinatura
  INSERT INTO public.platform_subscriptions (
    entity_type, entity_id, plan_id, plan_name,
    billing_cycle, status, payment_method, notes, current_period_end
  ) VALUES (
    p_entity_type::public.entity_type,
    p_entity_id,
    p_plan_id,
    v_plan_name,
    'monthly'::public.billing_cycle,
    'active'::public.sub_status,
    'manual'::public.payment_method,
    'Plano de teste ativado manualmente pela equipe de desenvolvimento',
    COALESCE(p_current_period_end, now() + interval '1 year')
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    plan_id              = EXCLUDED.plan_id,
    plan_name            = EXCLUDED.plan_name,
    billing_cycle        = EXCLUDED.billing_cycle,
    status               = EXCLUDED.status,
    payment_method       = EXCLUDED.payment_method,
    notes                = EXCLUDED.notes,
    current_period_end   = COALESCE(EXCLUDED.current_period_end, public.platform_subscriptions.current_period_end),
    updated_at           = now();
END;
$$;

-- Permite que qualquer usuário autenticado chame esta função
GRANT EXECUTE ON FUNCTION public.activate_test_plan(text, uuid, uuid, timestamptz) TO authenticated;
