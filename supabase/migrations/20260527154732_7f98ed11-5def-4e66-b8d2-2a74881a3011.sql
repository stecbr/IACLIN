
-- ============================================================
-- Super Admin RPC functions (iaclin@gmail.com only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_clinics int;
  v_doctors int;
  v_patients int;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_clinics FROM public.clinics;
  SELECT count(DISTINCT user_id) INTO v_doctors
    FROM public.clinic_members
    WHERE role IN ('admin', 'dentist');
  SELECT count(*) INTO v_patients
    FROM public.user_roles
    WHERE role = 'patient';

  RETURN jsonb_build_object(
    'total_clinics',  v_clinics,
    'total_doctors',  v_doctors,
    'total_patients', v_patients
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_clinics()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  city text,
  state text,
  email text,
  phone text,
  created_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.category::text,
    c.city,
    c.state,
    c.email,
    c.phone,
    c.created_at,
    COALESCE(m.cnt, 0) AS member_count
  FROM public.clinics c
  LEFT JOIN (
    SELECT clinic_id, count(*)::bigint AS cnt
    FROM public.clinic_members
    GROUP BY clinic_id
  ) m ON m.clinic_id = c.id
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_doctors()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  specialty text,
  registration_number text,
  role text,
  is_owner boolean,
  clinic_id uuid,
  clinic_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF v_email <> 'iaclin@gmail.com' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    cm.user_id,
    p.full_name,
    cm.specialty,
    cm.registration_number,
    cm.role::text,
    cm.is_owner,
    cm.clinic_id,
    c.name AS clinic_name,
    cm.created_at
  FROM public.clinic_members cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN public.clinics  c ON c.id = cm.clinic_id
  WHERE cm.role IN ('admin', 'dentist')
  ORDER BY cm.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_stats()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_clinics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_doctors() TO authenticated;
