CREATE OR REPLACE FUNCTION public.upsert_platform_subscription(
  p_entity_type entity_type,
  p_entity_id uuid,
  p_plan_id uuid DEFAULT NULL::uuid,
  p_billing_cycle billing_cycle DEFAULT 'monthly'::billing_cycle,
  p_status sub_status DEFAULT 'trial'::sub_status,
  p_payment_method payment_method DEFAULT 'manual'::payment_method,
  p_discount_type discount_type DEFAULT NULL::discount_type,
  p_discount_value numeric DEFAULT NULL::numeric,
  p_coupon_id uuid DEFAULT NULL::uuid,
  p_due_date date DEFAULT NULL::date,
  p_notes text DEFAULT NULL::text,
  p_current_period_end timestamptz DEFAULT NULL
)
RETURNS platform_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_plan_name TEXT;
  v_row public.platform_subscriptions;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_plan_name FROM public.platform_plans WHERE id = p_plan_id;

  INSERT INTO public.platform_subscriptions AS s (
    entity_type, entity_id, plan_id, plan_name, billing_cycle, status,
    payment_method, discount_type, discount_value, coupon_id, due_date, notes,
    current_period_end
  ) VALUES (
    p_entity_type, p_entity_id, p_plan_id, v_plan_name, p_billing_cycle, p_status,
    p_payment_method, p_discount_type, p_discount_value, p_coupon_id, p_due_date, p_notes,
    COALESCE(p_current_period_end, now() + interval '1 year')
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    plan_name = EXCLUDED.plan_name,
    billing_cycle = EXCLUDED.billing_cycle,
    status = EXCLUDED.status,
    payment_method = EXCLUDED.payment_method,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    coupon_id = EXCLUDED.coupon_id,
    due_date = EXCLUDED.due_date,
    notes = EXCLUDED.notes,
    current_period_end = COALESCE(EXCLUDED.current_period_end, s.current_period_end),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;