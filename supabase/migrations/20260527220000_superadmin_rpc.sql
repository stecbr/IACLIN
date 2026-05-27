-- ============================================================
-- Super Admin: funções RPC com SECURITY DEFINER
-- Contornam o RLS completamente — só liberam dados se o JWT
-- pertencer a iaclin@gmail.com
-- Cole no SQL Editor e clique em Run:
-- https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna/sql/new
-- ============================================================

-- 1. Identificação do admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT lower(
    (SELECT email FROM auth.users WHERE id = auth.uid())
  ) = 'iaclin@gmail.com'
$$;

-- 2. Estatísticas gerais
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinics  bigint;
  v_doctors  bigint;
  v_patients bigint;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*)          INTO v_clinics  FROM public.clinics;
  SELECT COUNT(DISTINCT user_id) INTO v_doctors
    FROM public.clinic_members WHERE role IN ('admin', 'dentist');
  SELECT COUNT(*)          INTO v_patients
    FROM public.user_roles WHERE role = 'patient';

  RETURN json_build_object(
    'total_clinics',  v_clinics,
    'total_doctors',  v_doctors,
    'total_patients', v_patients
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_stats() TO authenticated;

-- 3. Lista de clínicas
CREATE OR REPLACE FUNCTION public.admin_get_clinics()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        c.id,
        c.name,
        c.category,
        c.city,
        c.state,
        c.email,
        c.phone,
        c.created_at,
        (SELECT COUNT(*) FROM public.clinic_members cm
         WHERE cm.clinic_id = c.id) AS member_count
      FROM public.clinics c
      ORDER BY c.created_at DESC
    ) t
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_clinics() TO authenticated;

-- 4. Lista de médicos/profissionais
CREATE OR REPLACE FUNCTION public.admin_get_doctors()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        cm.user_id,
        p.full_name,
        cm.specialty,
        cm.registration_number,
        cm.role::text       AS role,
        cm.is_owner,
        cm.clinic_id,
        cl.name             AS clinic_name,
        cm.created_at
      FROM public.clinic_members cm
      LEFT JOIN public.profiles p  ON p.id  = cm.user_id
      LEFT JOIN public.clinics  cl ON cl.id = cm.clinic_id
      WHERE cm.role IN ('admin', 'dentist')
      ORDER BY cm.created_at DESC
    ) t
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_doctors() TO authenticated;

-- 5. Lista de operadoras de saúde / convênios
CREATE OR REPLACE FUNCTION public.admin_get_operators()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        id,
        name,
        legal_name,
        cnpj,
        ans_code,
        type,
        contact_email,
        contact_phone,
        responsible_name,
        logo_url,
        brand_color,
        is_active,
        created_at
      FROM public.insurance_operators
      ORDER BY name ASC
    ) t
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_get_operators() TO authenticated;
