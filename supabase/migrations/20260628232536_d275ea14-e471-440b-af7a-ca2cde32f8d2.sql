CREATE OR REPLACE FUNCTION public.get_clinic_seat_usage(_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_limit int;
  v_plan_id uuid;
  v_plan_name text;
  v_status text;
  v_has_sub boolean := false;
BEGIN
  IF NOT public.user_belongs_to_clinic(auth.uid(), _clinic_id)
     AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_used
    FROM public.clinic_members
    WHERE clinic_id = _clinic_id
      AND role IN ('admin','dentist')
      AND COALESCE(is_active, true) = true;

  SELECT s.plan_id, s.status::text, p.max_professionals, p.name
    INTO v_plan_id, v_status, v_limit, v_plan_name
    FROM public.platform_subscriptions s
    LEFT JOIN public.platform_plans p ON p.id = s.plan_id
    WHERE s.entity_type = 'clinic'
      AND s.entity_id = _clinic_id
    ORDER BY (s.status IN ('active','trial')) DESC, s.updated_at DESC
    LIMIT 1;

  v_has_sub := v_plan_id IS NOT NULL;

  RETURN jsonb_build_object(
    'used', COALESCE(v_used, 0),
    'limit', v_limit,
    'unlimited', v_limit IS NULL,
    'available', CASE WHEN v_limit IS NULL THEN 9999 ELSE GREATEST(v_limit - COALESCE(v_used,0), 0) END,
    'has_subscription', v_has_sub,
    'status', v_status,
    'plan_name', v_plan_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_seat_usage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_clinic_seat_available(_clinic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  v := public.get_clinic_seat_usage(_clinic_id);
  RETURN COALESCE((v->>'unlimited')::boolean, false)
      OR COALESCE((v->>'available')::int, 0) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_clinic_seat_available(uuid) TO authenticated, service_role;