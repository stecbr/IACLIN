-- Fix 1: handle_new_user must persist clinic category from signup metadata,
-- and store the owner's specialty/registration_number on their clinic_members row.

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
  v_clinic_category TEXT;
  v_category public.clinic_category;
  v_specialty TEXT;
  v_registration TEXT;
  v_full_name TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';
  v_clinic_category := NEW.raw_user_meta_data->>'clinic_category';
  v_specialty := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'specialty', '')), '');
  v_registration := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'registration_number', '')), '');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'responsible_name', NEW.email);

  -- Map metadata string to enum, fallback to 'outro'
  BEGIN
    v_category := COALESCE(v_clinic_category, 'outro')::public.clinic_category;
  EXCEPTION WHEN others THEN
    v_category := 'outro'::public.clinic_category;
  END;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, v_full_name)
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
    VALUES (v_trade_name, v_legal_name, v_responsible_name, v_cnpj, v_corp_email, v_phone, NEW.id, v_category)
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional_member' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'dentist')
    ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional' THEN
    -- Owner-as-professional: create their own clinic with the right category and seed their specialty
    INSERT INTO public.clinics (name, owner_id, category)
    VALUES (COALESCE(v_full_name, 'Minha clínica'), NEW.id, v_category)
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;

    -- auto_link_clinic_owner already created clinic_members row; update with specialty/registration
    IF v_specialty IS NOT NULL OR v_registration IS NOT NULL THEN
      UPDATE public.clinic_members
        SET specialty = COALESCE(v_specialty, specialty),
            registration_number = COALESCE(v_registration, registration_number)
        WHERE clinic_id = v_clinic_id AND user_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
