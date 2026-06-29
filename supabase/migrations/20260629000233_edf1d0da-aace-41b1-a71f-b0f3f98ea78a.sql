
-- 1. Subscription cancellation columns
ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 2. Update membership helpers to enforce is_active
CREATE OR REPLACE FUNCTION public.user_belongs_to_clinic(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id
      AND clinic_id = _clinic_id
      AND COALESCE(is_active, true) = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_member(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT clinic_id FROM public.clinic_members
   WHERE user_id = _user_id
     AND COALESCE(is_active, true) = true
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_owner(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id
      AND clinic_id = _clinic_id
      AND is_owner = true
      AND COALESCE(is_active, true) = true
  )
$$;

-- 3. Subscription cancellation RPCs
CREATE OR REPLACE FUNCTION public.request_subscription_cancellation(
  _entity_type entity_type,
  _entity_id uuid,
  _reason text DEFAULT NULL
)
RETURNS platform_subscriptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.platform_subscriptions;
BEGIN
  IF _entity_type = 'clinic' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clinic_members
       WHERE clinic_id = _entity_id
         AND user_id = auth.uid()
         AND (is_owner = true OR role = 'admin')
         AND COALESCE(is_active, true) = true
    ) AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.uid() <> _entity_id AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.platform_subscriptions
     SET cancel_at_period_end = true,
         cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
         cancellation_reason = _reason,
         updated_at = now()
   WHERE entity_type = _entity_type AND entity_id = _entity_id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_subscription(
  _entity_type entity_type,
  _entity_id uuid
)
RETURNS platform_subscriptions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.platform_subscriptions;
BEGIN
  IF _entity_type = 'clinic' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clinic_members
       WHERE clinic_id = _entity_id
         AND user_id = auth.uid()
         AND (is_owner = true OR role = 'admin')
         AND COALESCE(is_active, true) = true
    ) AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF auth.uid() <> _entity_id AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.platform_subscriptions
     SET cancel_at_period_end = false,
         cancellation_requested_at = NULL,
         cancellation_reason = NULL,
         updated_at = now()
   WHERE entity_type = _entity_type AND entity_id = _entity_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 4. Clinic member management RPCs
CREATE OR REPLACE FUNCTION public.remove_clinic_member(_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.clinic_members;
  v_clinic_name text;
  v_owner_count int;
BEGIN
  SELECT * INTO v_member FROM public.clinic_members WHERE id = _member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members
     WHERE clinic_id = v_member.clinic_id
       AND user_id = auth.uid()
       AND (is_owner = true OR role = 'admin')
       AND COALESCE(is_active, true) = true
  ) AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_member.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover a si mesmo';
  END IF;

  IF v_member.is_owner THEN
    SELECT COUNT(*) INTO v_owner_count
      FROM public.clinic_members
      WHERE clinic_id = v_member.clinic_id AND is_owner = true;
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover o único dono da clínica';
    END IF;
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = v_member.clinic_id;

  DELETE FROM public.clinic_members WHERE id = _member_id;

  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    NULL, v_member.user_id, 'system',
    'Você foi desvinculado de uma clínica',
    'Seu acesso à clínica ' || COALESCE(v_clinic_name, '') || ' foi encerrado. Você pode criar sua própria clínica ou aceitar um novo convite.',
    v_member.clinic_id, 'clinic'
  );

  RETURN jsonb_build_object('removed', true, 'user_id', v_member.user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_clinic_member_active(_member_id uuid, _is_active boolean)
RETURNS public.clinic_members
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member public.clinic_members;
  v_clinic_name text;
BEGIN
  SELECT * INTO v_member FROM public.clinic_members WHERE id = _member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_members
     WHERE clinic_id = v_member.clinic_id
       AND user_id = auth.uid()
       AND (is_owner = true OR role = 'admin')
       AND COALESCE(is_active, true) = true
  ) AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_member.user_id = auth.uid() AND _is_active = false THEN
    RAISE EXCEPTION 'Você não pode suspender a si mesmo';
  END IF;

  UPDATE public.clinic_members SET is_active = _is_active WHERE id = _member_id RETURNING * INTO v_member;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = v_member.clinic_id;
  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    v_member.clinic_id, v_member.user_id, 'system',
    CASE WHEN _is_active THEN 'Acesso reativado' ELSE 'Acesso suspenso' END,
    CASE WHEN _is_active
         THEN 'Seu acesso à clínica ' || COALESCE(v_clinic_name,'') || ' foi reativado.'
         ELSE 'Seu acesso à clínica ' || COALESCE(v_clinic_name,'') || ' foi temporariamente suspenso.'
    END,
    v_member.clinic_id, 'clinic'
  );

  RETURN v_member;
END;
$$;
