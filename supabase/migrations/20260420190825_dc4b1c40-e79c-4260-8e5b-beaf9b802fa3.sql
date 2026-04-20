-- Add new columns to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS responsible_name text;

-- Add CRM/CRO column to clinic_members
ALTER TABLE public.clinic_members ADD COLUMN IF NOT EXISTS registration_number text;

-- Update handle_new_user to support 'clinica' user_type
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

  -- Always create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'responsible_name', NEW.email));

  IF v_user_type = 'cliente' THEN
    -- Patient signup: create patient_account and assign 'patient' role
    v_cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_insurance_provider := NEW.raw_user_meta_data->>'insurance_provider';
    v_insurance_number := NEW.raw_user_meta_data->>'insurance_number';

    IF v_cpf IS NOT NULL THEN
      INSERT INTO public.patient_accounts (user_id, cpf, full_name, phone, insurance_provider, insurance_number)
      VALUES (
        NEW.id,
        v_cpf,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        v_phone,
        v_insurance_provider,
        v_insurance_number
      )
      ON CONFLICT (cpf) DO NOTHING;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'clinica' THEN
    -- Clinic signup: create clinic + assign admin role
    v_legal_name := NEW.raw_user_meta_data->>'legal_name';
    v_trade_name := COALESCE(NEW.raw_user_meta_data->>'trade_name', v_legal_name);
    v_cnpj := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'), '');
    v_corp_email := COALESCE(NEW.raw_user_meta_data->>'corporate_email', NEW.email);
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_responsible_name := NEW.raw_user_meta_data->>'responsible_name';

    INSERT INTO public.clinics (name, legal_name, responsible_name, cnpj, email, phone, owner_id, category)
    VALUES (
      v_trade_name,
      v_legal_name,
      v_responsible_name,
      v_cnpj,
      v_corp_email,
      v_phone,
      NEW.id,
      'outro'::clinic_category
    )
    RETURNING id INTO v_clinic_id;

    -- auto_link_clinic_owner trigger handles clinic_members insert

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure auto_link_clinic_owner trigger exists on clinics
DROP TRIGGER IF EXISTS on_clinic_created_link_owner ON public.clinics;
CREATE TRIGGER on_clinic_created_link_owner
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_clinic_owner();