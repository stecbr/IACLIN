-- Expõe brand_group nas RPCs de operadora (listagem e upsert manual pelo super admin)

CREATE OR REPLACE FUNCTION public.admin_get_all_operators()
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
           approval_status, rejection_reason, reviewed_at, reviewed_by,
           is_platform_account, brand_group,
           modality, address_street, address_number, address_complement,
           address_district, address_city, address_state, address_zip,
           phone_area_code, fax,
           representative_role, ans_registered_at
    FROM public.insurance_operators
    ORDER BY name ASC
  ) o;
END;
$function$;

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
      logo_url, brand_color, brand_group, is_active, approval_status
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
      nullif(payload->>'brand_group',''),
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
      brand_group = nullif(payload->>'brand_group',''),
      is_active = coalesce((payload->>'is_active')::boolean, is_active),
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
  END IF;

  RETURN v_row;
END; $$;
