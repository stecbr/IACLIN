CREATE OR REPLACE FUNCTION public.resolve_or_create_ai_tenant_for_clinic(_clinic_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_clinic_name text;
BEGIN
  IF _clinic_id IS NULL THEN
    RAISE EXCEPTION 'clinic_id is required to resolve ai_tenant'
      USING ERRCODE = '22023';
  END IF;

  SELECT id, display_name INTO v_tenant_id, v_clinic_name
    FROM public.ai_tenants
    WHERE owner_type = 'clinic' AND clinic_id = _clinic_id
    LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = _clinic_id;
  IF v_clinic_name IS NULL THEN
    RAISE EXCEPTION 'clinic % does not exist; refusing to create orphan ai_tenant', _clinic_id
      USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.ai_tenants(owner_type, clinic_id, display_name)
    VALUES ('clinic', _clinic_id, v_clinic_name)
    RETURNING id INTO v_tenant_id;
  RETURN v_tenant_id;
END;
$function$;