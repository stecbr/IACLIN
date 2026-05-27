CREATE OR REPLACE FUNCTION public.admin_get_operators()
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'email') <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_jsonb(o) - 'slug' - 'owner_id' - 'updated_at'
  FROM (
    SELECT id, name, legal_name, cnpj, ans_code, type,
           contact_email, contact_phone, responsible_name,
           logo_url, brand_color, is_active, created_at,
           slug, owner_id, updated_at
    FROM public.insurance_operators
    ORDER BY created_at DESC
  ) o;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_operators() TO authenticated;