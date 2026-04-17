
-- 1. Add 'patient' value to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'patient';

-- 2. Create patient_accounts table
CREATE TABLE IF NOT EXISTS public.patient_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  cpf TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  insurance_provider TEXT,
  insurance_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_accounts_user_id ON public.patient_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_accounts_cpf ON public.patient_accounts(cpf);

ALTER TABLE public.patient_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own account"
  ON public.patient_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can update own account"
  ON public.patient_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert own account"
  ON public.patient_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_patient_accounts_updated_at
  BEFORE UPDATE ON public.patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add patient_user_id to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_patients_patient_user_id ON public.patients(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf);

-- 4. Function: link patients to patient_account by CPF
CREATE OR REPLACE FUNCTION public.link_patients_by_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a patient_account is created/updated, link all patients rows with same CPF
  IF TG_TABLE_NAME = 'patient_accounts' THEN
    IF NEW.cpf IS NOT NULL THEN
      UPDATE public.patients
        SET patient_user_id = NEW.user_id
        WHERE cpf = NEW.cpf AND (patient_user_id IS NULL OR patient_user_id <> NEW.user_id);
    END IF;
  END IF;

  -- When a patients row is created/updated with a CPF, look up matching account
  IF TG_TABLE_NAME = 'patients' THEN
    IF NEW.cpf IS NOT NULL AND NEW.patient_user_id IS NULL THEN
      SELECT user_id INTO NEW.patient_user_id
        FROM public.patient_accounts
        WHERE cpf = NEW.cpf
        LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER patient_accounts_link_cpf
  AFTER INSERT OR UPDATE OF cpf ON public.patient_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.link_patients_by_cpf();

CREATE TRIGGER patients_link_cpf
  BEFORE INSERT OR UPDATE OF cpf ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.link_patients_by_cpf();

-- 5. Update handle_new_user to create patient_account + role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type TEXT;
  v_cpf TEXT;
  v_phone TEXT;
  v_insurance_provider TEXT;
  v_insurance_number TEXT;
BEGIN
  v_user_type := NEW.raw_user_meta_data->>'user_type';

  -- Always create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

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
  END IF;

  RETURN NEW;
END;
$$;

-- 6. RLS policies: patient can view own data across tables
CREATE POLICY "Patients can view own patient records"
  ON public.patients FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

CREATE POLICY "Patients can update own patient records"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (patient_user_id = auth.uid());

CREATE POLICY "Patients can view own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can update own appointments"
  ON public.appointments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = appointments.patient_id AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = documents.patient_id AND p.patient_user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view own clinical records"
  ON public.clinical_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      WHERE p.id = clinical_records.patient_id AND p.patient_user_id = auth.uid()
    )
  );
