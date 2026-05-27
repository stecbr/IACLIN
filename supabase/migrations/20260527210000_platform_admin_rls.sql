-- ============================================================
-- SQL MÍNIMO para o Super Admin da plataforma conseguir ler dados
-- Cole isso no Supabase Dashboard → SQL Editor e clique em Run
-- URL: https://supabase.com/dashboard/project/fwyulywxhjyxdreeuqna/sql/new
-- ============================================================

-- 1. Função que identifica o admin pelo e-mail do JWT
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT lower((SELECT email FROM auth.users WHERE id = auth.uid())) = 'iaclin@gmail.com'
$$;

-- 2. Permissão de leitura em clinics
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clinics'
      AND policyname = 'platform_admin_read_clinics'
  ) THEN
    CREATE POLICY "platform_admin_read_clinics"
      ON public.clinics FOR SELECT TO authenticated
      USING (public.is_platform_admin());
  END IF;
END $$;

-- 3. Permissão de leitura em clinic_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clinic_members'
      AND policyname = 'platform_admin_read_clinic_members'
  ) THEN
    CREATE POLICY "platform_admin_read_clinic_members"
      ON public.clinic_members FOR SELECT TO authenticated
      USING (public.is_platform_admin());
  END IF;
END $$;

-- 4. Permissão de leitura em user_roles (só para contar pacientes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND policyname = 'platform_admin_read_user_roles'
  ) THEN
    CREATE POLICY "platform_admin_read_user_roles"
      ON public.user_roles FOR SELECT TO authenticated
      USING (public.is_platform_admin());
  END IF;
END $$;

-- 5. Permissão de leitura em profiles (para nome dos médicos)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'platform_admin_read_profiles'
  ) THEN
    CREATE POLICY "platform_admin_read_profiles"
      ON public.profiles FOR SELECT TO authenticated
      USING (public.is_platform_admin());
  END IF;
END $$;

-- Pronto! O painel do super admin já vai mostrar os dados.
