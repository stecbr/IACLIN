-- admin_get_all_operators referenciava colunas inexistentes (address_neighborhood,
-- address_zipcode, contact_ddd, contact_fax, contact_website, responsible_role,
-- ans_registration_date, ans_registry), causando erro silencioso e a tela
-- "Banco de dados de operadoras" sempre vazia. Corrige para os nomes reais
-- criados em 20260630162027_383b81e6-755c-4e8c-901a-d3903607c663.sql.

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
           is_platform_account,
           modality, address_street, address_number, address_complement,
           address_district, address_city, address_state, address_zip,
           phone_area_code, fax,
           representative_role, ans_registered_at
    FROM public.insurance_operators
    ORDER BY name ASC
  ) o;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_operators() TO authenticated;
