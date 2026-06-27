
-- 1. Add approval columns to insurance_operators
ALTER TABLE public.insurance_operators
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

DO $$ BEGIN
  ALTER TABLE public.insurance_operators
    ADD CONSTRAINT insurance_operators_approval_status_check
    CHECK (approval_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Mark all existing operators as approved (only new signups need review)
UPDATE public.insurance_operators SET approval_status = 'approved', reviewed_at = COALESCE(reviewed_at, now()) WHERE approval_status = 'pending';

-- 2. Update admin_get_operators to include approval fields
CREATE OR REPLACE FUNCTION public.admin_get_operators()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(o)
  FROM (
    SELECT id, name, legal_name, cnpj, ans_code, type,
           contact_email, contact_phone, responsible_name,
           logo_url, brand_color, is_active, created_at,
           slug, owner_id, updated_at, active_states,
           approval_status, rejection_reason, reviewed_at, reviewed_by
    FROM public.insurance_operators
    ORDER BY (approval_status = 'pending') DESC, created_at DESC
  ) o;
END;
$function$;

-- 3. RPC for super admin to approve/reject
CREATE OR REPLACE FUNCTION public.admin_set_operator_approval(
  _operator_id uuid,
  _status text,
  _reason text DEFAULT NULL
)
RETURNS public.insurance_operators
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.insurance_operators;
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status %', _status USING ERRCODE = '22023';
  END IF;

  UPDATE public.insurance_operators
    SET approval_status = _status,
        rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE NULL END,
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        is_active = (_status = 'approved'),
        updated_at = now()
    WHERE id = _operator_id
    RETURNING * INTO v_row;

  -- Notify the operator owner
  IF v_row.owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NULL, v_row.owner_id, 'system',
      CASE WHEN _status = 'approved' THEN 'Cadastro aprovado'
           WHEN _status = 'rejected' THEN 'Cadastro recusado'
           ELSE 'Cadastro em análise' END,
      CASE WHEN _status = 'approved' THEN 'Sua operadora foi aprovada. Acesso liberado.'
           WHEN _status = 'rejected' THEN COALESCE('Motivo: ' || _reason, 'Seu cadastro foi recusado.')
           ELSE 'Seu cadastro voltou para análise.' END,
      v_row.id, 'insurance_operator'
    );
  END IF;

  RETURN v_row;
END;
$$;

-- 4. RPC for the operator owner to check their own approval status (used by gate)
CREATE OR REPLACE FUNCTION public.get_my_operator_status()
RETURNS TABLE(operator_id uuid, name text, approval_status text, rejection_reason text, reviewed_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.name, o.approval_status, o.rejection_reason, o.reviewed_at
  FROM public.insurance_operators o
  JOIN public.operator_members m ON m.operator_id = o.id
  WHERE m.user_id = auth.uid()
  ORDER BY (o.approval_status = 'approved') DESC
  LIMIT 1;
$$;
