-- 1. Update handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_type TEXT;
  v_cpf TEXT;
  v_phone TEXT;
  v_insurance_provider TEXT;
  v_insurance_number TEXT;
  v_clinic_id UUID;
  v_legal_name TEXT;
  v_trade_name TEXT;
  v_cnpj TEXT;
  v_corp_email TEXT;
  v_responsible_name TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'responsible_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF v_user_type = 'cliente' THEN
    v_cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_insurance_provider := NEW.raw_user_meta_data->>'insurance_provider';
    v_insurance_number := NEW.raw_user_meta_data->>'insurance_number';

    IF v_cpf IS NOT NULL THEN
      INSERT INTO public.patient_accounts (user_id, cpf, full_name, phone, insurance_provider, insurance_number)
      VALUES (NEW.id, v_cpf, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), v_phone, v_insurance_provider, v_insurance_number)
      ON CONFLICT (cpf) DO NOTHING;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'clinica' THEN
    v_legal_name := NEW.raw_user_meta_data->>'legal_name';
    v_trade_name := COALESCE(NEW.raw_user_meta_data->>'trade_name', v_legal_name);
    v_cnpj := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'), '');
    v_corp_email := COALESCE(NEW.raw_user_meta_data->>'corporate_email', NEW.email);
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_responsible_name := NEW.raw_user_meta_data->>'responsible_name';

    INSERT INTO public.clinics (name, legal_name, responsible_name, cnpj, email, phone, owner_id, category)
    VALUES (v_trade_name, v_legal_name, v_responsible_name, v_cnpj, v_corp_email, v_phone, NEW.id, 'outro'::clinic_category)
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional_member' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'dentist')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Ensure handle_new_user trigger is on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Attach auto_link_clinic_owner to clinics
DROP TRIGGER IF EXISTS on_clinic_created_link_owner ON public.clinics;
CREATE TRIGGER on_clinic_created_link_owner
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_clinic_owner();

-- 4. Backfill clinic_members for existing owners
INSERT INTO public.clinic_members (clinic_id, user_id, role, is_owner)
SELECT c.id, c.owner_id, 'admin', true
FROM public.clinics c
WHERE c.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members m
    WHERE m.clinic_id = c.id AND m.user_id = c.owner_id
  )
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- 5. Drop assign_default_role + dependent trigger (was on profiles, wrong table)
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;
DROP FUNCTION IF EXISTS public.assign_default_role() CASCADE;

-- 6. Dedupe legacy admin roles for users who are dentists
DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.user_id = ur.user_id AND cm.role = 'dentist'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.clinic_members cm2
    WHERE cm2.user_id = ur.user_id AND cm2.is_owner = true
  );

-- 7. Belt & suspenders insert policy on user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'System can insert roles'
  ) THEN
    CREATE POLICY "System can insert roles" ON public.user_roles
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;