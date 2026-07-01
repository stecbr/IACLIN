-- BUG: handle_new_user() nunca inseria o usuário em operator_members ao criar/reivindicar
-- uma conta de operadora. get_my_operator_status() depende desse vínculo (JOIN
-- operator_members) para achar o approval_status; sem ele a RPC retorna vazio, o front
-- interpreta opStatus=null como "sem restrição" e libera o painel direto, pulando a
-- tela de aprovação pendente mesmo com approval_status='pending'.

-- 1) Backfill: cria o vínculo que faltou para contas de operadora já existentes.
INSERT INTO public.operator_members (operator_id, user_id, role, is_owner)
SELECT o.id, o.owner_id, 'admin', true
FROM public.insurance_operators o
WHERE o.owner_id IS NOT NULL
ON CONFLICT (operator_id, user_id) DO NOTHING;

-- 2) Corrige handle_new_user para sempre criar o vínculo daqui pra frente.
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
  v_ans_code TEXT;
  v_operator_type TEXT;
  v_operator_id UUID;
  v_catalog_operator_id UUID;
  v_existing_id UUID;
  v_rg TEXT;
  v_profession TEXT;
  v_dob DATE;
  v_gender TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';
  v_clinic_category := NEW.raw_user_meta_data->>'clinic_category';
  v_specialty := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'specialty', '')), '');
  v_registration := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'registration_number', '')), '');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'responsible_name', NEW.email);

  BEGIN
    v_category := COALESCE(v_clinic_category, 'outro')::public.clinic_category;
  EXCEPTION WHEN others THEN
    v_category := 'outro'::public.clinic_category;
  END;

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, v_full_name)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  IF v_user_type IN ('profissional_member','profissional') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'dentist') ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'cliente' THEN
    v_cpf := NEW.raw_user_meta_data->>'cpf';
    v_phone := NEW.raw_user_meta_data->>'phone';
    v_insurance_provider := NEW.raw_user_meta_data->>'insurance_provider';
    v_insurance_number := NEW.raw_user_meta_data->>'insurance_number';
    v_dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
    v_gender := NEW.raw_user_meta_data->>'gender';
    v_rg := NEW.raw_user_meta_data->>'rg';
    v_profession := NEW.raw_user_meta_data->>'profession';

    INSERT INTO public.patient_accounts (
      user_id, full_name, email, cpf, phone, date_of_birth, gender, rg, profession,
      insurance_provider, insurance_number
    ) VALUES (
      NEW.id, v_full_name, NEW.email, v_cpf, v_phone, v_dob, v_gender, v_rg, v_profession,
      v_insurance_provider, v_insurance_number
    ) ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'clinica' THEN
    v_legal_name := NEW.raw_user_meta_data->>'legal_name';
    v_trade_name := COALESCE(NEW.raw_user_meta_data->>'trade_name', v_legal_name, v_full_name);
    v_cnpj := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'), '');
    v_corp_email := NEW.raw_user_meta_data->>'corporate_email';
    v_responsible_name := NEW.raw_user_meta_data->>'responsible_name';
    v_phone := NEW.raw_user_meta_data->>'phone';

    INSERT INTO public.clinics (
      name, legal_name, trade_name, cnpj, corporate_email, phone, responsible_name,
      category, owner_id
    ) VALUES (
      v_trade_name, v_legal_name, v_trade_name, v_cnpj, v_corp_email, v_phone, v_responsible_name,
      v_category, NEW.id
    ) RETURNING id INTO v_clinic_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'operadora' THEN
    v_legal_name := NEW.raw_user_meta_data->>'legal_name';
    v_trade_name := COALESCE(NEW.raw_user_meta_data->>'trade_name', v_legal_name, v_full_name);
    v_cnpj := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'), '');
    v_ans_code := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'ans_code', '')), '');
    v_operator_type := COALESCE(NEW.raw_user_meta_data->>'operator_type', 'ambos');
    v_responsible_name := NEW.raw_user_meta_data->>'responsible_name';
    v_phone := NEW.raw_user_meta_data->>'phone';
    BEGIN
      v_catalog_operator_id := NULLIF(NEW.raw_user_meta_data->>'catalog_operator_id','')::uuid;
    EXCEPTION WHEN others THEN
      v_catalog_operator_id := NULL;
    END;

    -- Try to find an existing catalog operator to claim (must NOT have an owner yet)
    SELECT id INTO v_existing_id
    FROM public.insurance_operators
    WHERE owner_id IS NULL
      AND (
        (v_catalog_operator_id IS NOT NULL AND id = v_catalog_operator_id)
        OR (v_ans_code IS NOT NULL AND ans_code = v_ans_code)
        OR (v_cnpj IS NOT NULL AND regexp_replace(coalesce(cnpj,''), '\D','','g') = v_cnpj)
      )
    ORDER BY (id = v_catalog_operator_id) DESC,
             (ans_code = v_ans_code) DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.insurance_operators
      SET owner_id = NEW.id,
          is_platform_account = true,
          approval_status = 'pending',
          contact_email = COALESCE(NULLIF(contact_email,''), NEW.email),
          contact_phone = COALESCE(contact_phone, v_phone),
          responsible_name = COALESCE(responsible_name, v_responsible_name),
          type = COALESCE(v_operator_type, type),
          updated_at = now()
      WHERE id = v_existing_id
      RETURNING id INTO v_operator_id;
    ELSE
      INSERT INTO public.insurance_operators (
        name, legal_name, cnpj, ans_code, type, responsible_name,
        contact_email, contact_phone, owner_id,
        is_platform_account, approval_status
      )
      VALUES (
        v_trade_name, v_legal_name, v_cnpj, v_ans_code, v_operator_type, v_responsible_name,
        NEW.email, v_phone, NEW.id,
        true, 'pending'
      )
      RETURNING id INTO v_operator_id;
    END IF;

    INSERT INTO public.operator_members (operator_id, user_id, role, is_owner)
    VALUES (v_operator_id, NEW.id, 'admin', true)
    ON CONFLICT (operator_id, user_id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
