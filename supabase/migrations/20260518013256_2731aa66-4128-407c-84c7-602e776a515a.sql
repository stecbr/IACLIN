
-- 1) Novo app_role: operator
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operator';

-- 2) insurance_operators (operadora master, global)
CREATE TABLE IF NOT EXISTS public.insurance_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  legal_name text,
  cnpj text,
  ans_code text,
  type text NOT NULL DEFAULT 'ambos' CHECK (type IN ('medico','odonto','ambos')),
  brand_color text,
  logo_url text,
  contact_email text,
  contact_phone text,
  responsible_name text,
  owner_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_insurance_operators_updated_at
  BEFORE UPDATE ON public.insurance_operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.insurance_operators ENABLE ROW LEVEL SECURITY;

-- 3) operator_members
CREATE TABLE IF NOT EXISTS public.operator_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','analyst')),
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, user_id)
);

ALTER TABLE public.operator_members ENABLE ROW LEVEL SECURITY;

-- helper: user belongs to operator
CREATE OR REPLACE FUNCTION public.user_belongs_to_operator(_user_id uuid, _operator_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operator_members
    WHERE user_id = _user_id AND operator_id = _operator_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_operator_member(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT operator_id FROM public.operator_members WHERE user_id = _user_id
$$;

-- auto-link operator owner
CREATE OR REPLACE FUNCTION public.auto_link_operator_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.operator_members (operator_id, user_id, role, is_owner)
    VALUES (NEW.id, NEW.owner_id, 'admin', true)
    ON CONFLICT (operator_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_link_operator_owner
  AFTER INSERT ON public.insurance_operators
  FOR EACH ROW EXECUTE FUNCTION public.auto_link_operator_owner();

-- 4) operator_credentialings
CREATE TABLE IF NOT EXISTS public.operator_credentialings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL,
  clinic_member_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','revoked')),
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, clinic_member_id)
);

CREATE INDEX idx_op_cred_operator ON public.operator_credentialings(operator_id, status);
CREATE INDEX idx_op_cred_clinic ON public.operator_credentialings(clinic_id);
CREATE INDEX idx_op_cred_member ON public.operator_credentialings(clinic_member_id);

CREATE TRIGGER trg_op_cred_updated_at
  BEFORE UPDATE ON public.operator_credentialings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.operator_credentialings ENABLE ROW LEVEL SECURITY;

-- 5) clinic_member_insurance_plans (médico ↔ convênio aceito)
CREATE TABLE IF NOT EXISTS public.clinic_member_insurance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_member_id uuid NOT NULL,
  insurance_plan_id uuid NOT NULL REFERENCES public.insurance_plans(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.insurance_operators(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_member_id, insurance_plan_id)
);

ALTER TABLE public.clinic_member_insurance_plans ENABLE ROW LEVEL SECURITY;

-- 6) Link opcional plano -> operadora master
ALTER TABLE public.insurance_plans
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.insurance_operators(id) ON DELETE SET NULL;

-- 7) Slot de disponibilidade por convênio (opcional)
ALTER TABLE public.professional_availability
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES public.insurance_operators(id) ON DELETE SET NULL;

-- =========================
-- RLS POLICIES
-- =========================

-- insurance_operators
CREATE POLICY "Anyone can view active operators"
  ON public.insurance_operators FOR SELECT TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Operator members can update own operator"
  ON public.insurance_operators FOR UPDATE TO authenticated
  USING (public.user_belongs_to_operator(auth.uid(), id));

CREATE POLICY "Authenticated can create operator"
  ON public.insurance_operators FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- operator_members
CREATE POLICY "Operator members can view own membership"
  ON public.operator_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_belongs_to_operator(auth.uid(), operator_id));

CREATE POLICY "Operator owners can manage members"
  ON public.operator_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.operator_id = operator_members.operator_id
      AND om.user_id = auth.uid() AND om.is_owner = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.operator_members om
    WHERE om.operator_id = operator_members.operator_id
      AND om.user_id = auth.uid() AND om.is_owner = true
  ));

-- operator_credentialings
CREATE POLICY "Members of operator or clinic can view credentialings"
  ON public.operator_credentialings FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_operator(auth.uid(), operator_id)
    OR public.user_belongs_to_clinic(auth.uid(), clinic_id)
    OR professional_user_id = auth.uid()
  );

CREATE POLICY "Clinic members can request credentialing"
  ON public.operator_credentialings FOR INSERT TO authenticated
  WITH CHECK (
    public.user_belongs_to_clinic(auth.uid(), clinic_id)
    AND status = 'pending'
  );

CREATE POLICY "Operator can decide credentialing"
  ON public.operator_credentialings FOR UPDATE TO authenticated
  USING (public.user_belongs_to_operator(auth.uid(), operator_id))
  WITH CHECK (public.user_belongs_to_operator(auth.uid(), operator_id));

CREATE POLICY "Clinic can cancel own credentialing"
  ON public.operator_credentialings FOR DELETE TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

-- clinic_member_insurance_plans
CREATE POLICY "Anyone can view member insurance plans"
  ON public.clinic_member_insurance_plans FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Member or admin can manage own insurance plans"
  ON public.clinic_member_insurance_plans FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = clinic_member_insurance_plans.clinic_member_id
      AND (cm.user_id = auth.uid()
        OR public.is_clinic_owner(auth.uid(), cm.clinic_id)
        OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), cm.clinic_id)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.id = clinic_member_insurance_plans.clinic_member_id
      AND (cm.user_id = auth.uid()
        OR public.is_clinic_owner(auth.uid(), cm.clinic_id)
        OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), cm.clinic_id)))
  ));

-- =========================
-- handle_new_user: branch operadora
-- =========================
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

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient') ON CONFLICT DO NOTHING;

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

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional_member' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'dentist') ON CONFLICT DO NOTHING;

  ELSIF v_user_type = 'profissional' THEN
    INSERT INTO public.clinics (name, owner_id, category)
    VALUES (COALESCE(v_full_name, 'Minha clínica'), NEW.id, v_category)
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;

    IF v_specialty IS NOT NULL OR v_registration IS NOT NULL THEN
      UPDATE public.clinic_members
        SET specialty = COALESCE(v_specialty, specialty),
            registration_number = COALESCE(v_registration, registration_number)
        WHERE clinic_id = v_clinic_id AND user_id = NEW.id;
    END IF;

  ELSIF v_user_type = 'operadora' THEN
    v_legal_name := NEW.raw_user_meta_data->>'legal_name';
    v_trade_name := COALESCE(NEW.raw_user_meta_data->>'trade_name', v_legal_name, v_full_name);
    v_cnpj := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'cnpj', ''), '\D', '', 'g'), '');
    v_ans_code := NEW.raw_user_meta_data->>'ans_code';
    v_operator_type := COALESCE(NEW.raw_user_meta_data->>'operator_type', 'ambos');
    v_responsible_name := NEW.raw_user_meta_data->>'responsible_name';
    v_phone := NEW.raw_user_meta_data->>'phone';

    INSERT INTO public.insurance_operators (
      name, legal_name, cnpj, ans_code, type, responsible_name,
      contact_email, contact_phone, owner_id
    )
    VALUES (
      v_trade_name, v_legal_name, v_cnpj, v_ans_code, v_operator_type, v_responsible_name,
      NEW.email, v_phone, NEW.id
    )
    RETURNING id INTO v_operator_id;

    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- =========================
-- Notificações de credenciamento
-- =========================
CREATE OR REPLACE FUNCTION public.notify_credentialing_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_operator_name text;
  v_member RECORD;
BEGIN
  SELECT name INTO v_operator_name FROM public.insurance_operators WHERE id = NEW.operator_id;

  IF TG_OP = 'INSERT' THEN
    -- notifica membros da operadora
    FOR v_member IN SELECT user_id FROM public.operator_members WHERE operator_id = NEW.operator_id LOOP
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (NULL, v_member.user_id, 'credentialing', 'Novo pedido de credenciamento',
        'Um profissional solicitou credenciamento.', NEW.id, 'operator_credentialing');
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NEW.clinic_id, NEW.professional_user_id, 'credentialing',
      CASE NEW.status
        WHEN 'approved' THEN 'Credenciamento aprovado'
        WHEN 'rejected' THEN 'Credenciamento recusado'
        WHEN 'revoked' THEN 'Credenciamento revogado'
        ELSE 'Credenciamento atualizado'
      END,
      'Operadora ' || COALESCE(v_operator_name, '') || ': ' || NEW.status
        || CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' — ' || NEW.rejection_reason ELSE '' END,
      NEW.id, 'operator_credentialing'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_credentialing
  AFTER INSERT OR UPDATE ON public.operator_credentialings
  FOR EACH ROW EXECUTE FUNCTION public.notify_credentialing_change();
