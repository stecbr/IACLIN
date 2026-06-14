
-- =========================
-- patient_link_requests
-- =========================
CREATE TABLE public.patient_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_user_id UUID NOT NULL,
  cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plr_patient ON public.patient_link_requests(patient_user_id, status);
CREATE INDEX idx_plr_requester ON public.patient_link_requests(requested_by_user_id, status);
CREATE INDEX idx_plr_clinic ON public.patient_link_requests(clinic_id, status);
CREATE INDEX idx_plr_cpf ON public.patient_link_requests(cpf);

GRANT SELECT, INSERT, UPDATE ON public.patient_link_requests TO authenticated;
GRANT ALL ON public.patient_link_requests TO service_role;

ALTER TABLE public.patient_link_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester sees own link requests"
  ON public.patient_link_requests FOR SELECT TO authenticated
  USING (requested_by_user_id = auth.uid());

CREATE POLICY "patient sees own link requests"
  ON public.patient_link_requests FOR SELECT TO authenticated
  USING (patient_user_id = auth.uid());

CREATE POLICY "requester creates link requests"
  ON public.patient_link_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "requester updates own pending requests"
  ON public.patient_link_requests FOR UPDATE TO authenticated
  USING (requested_by_user_id = auth.uid())
  WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "patient responds to own link requests"
  ON public.patient_link_requests FOR UPDATE TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE TRIGGER trg_plr_updated_at
  BEFORE UPDATE ON public.patient_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- patient_invites
-- =========================
CREATE TABLE public.patient_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  requested_by_user_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_user_id UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pinv_cpf ON public.patient_invites(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_pinv_email ON public.patient_invites(lower(email));
CREATE INDEX idx_pinv_requester ON public.patient_invites(requested_by_user_id, status);

GRANT SELECT, INSERT, UPDATE ON public.patient_invites TO authenticated;
GRANT ALL ON public.patient_invites TO service_role;

ALTER TABLE public.patient_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester sees own invites"
  ON public.patient_invites FOR SELECT TO authenticated
  USING (requested_by_user_id = auth.uid());

CREATE POLICY "requester creates invites"
  ON public.patient_invites FOR INSERT TO authenticated
  WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "requester updates own invites"
  ON public.patient_invites FOR UPDATE TO authenticated
  USING (requested_by_user_id = auth.uid())
  WITH CHECK (requested_by_user_id = auth.uid());

CREATE TRIGGER trg_pinv_updated_at
  BEFORE UPDATE ON public.patient_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- Trigger: on accept, create/link patients row in clinic
-- =========================
CREATE OR REPLACE FUNCTION public.on_patient_link_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.patient_accounts;
  v_existing_id UUID;
  v_requester_clinic_id UUID;
BEGIN
  IF NEW.status <> 'accepted' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  NEW.responded_at := now();

  SELECT * INTO v_account FROM public.patient_accounts WHERE user_id = NEW.patient_user_id LIMIT 1;
  IF v_account.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_requester_clinic_id := NEW.clinic_id;

  -- Find existing patient in clinic (by CPF) or globally for this requester
  IF v_requester_clinic_id IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.patients
      WHERE clinic_id = v_requester_clinic_id AND cpf = v_account.cpf
      LIMIT 1;
  ELSE
    SELECT id INTO v_existing_id FROM public.patients
      WHERE dentist_id = NEW.requested_by_user_id AND cpf = v_account.cpf
      LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.patients
      SET patient_user_id = v_account.user_id,
          updated_at = now()
      WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.patients (
      clinic_id, dentist_id, patient_user_id,
      full_name, cpf, phone, date_of_birth, gender,
      insurance_provider, insurance_number, is_active
    ) VALUES (
      v_requester_clinic_id,
      CASE WHEN v_requester_clinic_id IS NULL THEN NEW.requested_by_user_id ELSE NULL END,
      v_account.user_id,
      v_account.full_name, v_account.cpf, v_account.phone, v_account.date_of_birth, v_account.gender,
      v_account.insurance_provider, v_account.insurance_number, true
    );
  END IF;

  -- Notify requester
  INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    v_requester_clinic_id, NEW.requested_by_user_id,
    'patient_link',
    'Vinculação aceita',
    COALESCE(v_account.full_name, 'O paciente') || ' aceitou sua solicitação de vinculação.',
    NEW.id, 'patient_link_request'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_plr_accepted
  BEFORE UPDATE ON public.patient_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_patient_link_request_accepted();

-- Notify rejection
CREATE OR REPLACE FUNCTION public.on_patient_link_request_rejected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NEW.clinic_id, NEW.requested_by_user_id,
      'patient_link',
      'Vinculação recusada',
      'O paciente recusou sua solicitação de vinculação.',
      NEW.id, 'patient_link_request'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_plr_rejected
  AFTER UPDATE ON public.patient_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_patient_link_request_rejected();

-- =========================
-- Auto-accept invites on signup
-- =========================
CREATE OR REPLACE FUNCTION public.auto_accept_patient_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  FOR v_invite IN
    SELECT * FROM public.patient_invites
    WHERE status = 'pending'
      AND expires_at > now()
      AND (
        (cpf IS NOT NULL AND cpf = NEW.cpf)
      )
  LOOP
    UPDATE public.patient_invites
      SET status = 'accepted', accepted_user_id = NEW.user_id, accepted_at = now()
      WHERE id = v_invite.id;

    -- Link existing patients row in the requester clinic or create one
    UPDATE public.patients
      SET patient_user_id = NEW.user_id, updated_at = now()
      WHERE cpf = NEW.cpf
        AND (clinic_id = v_invite.clinic_id OR (v_invite.clinic_id IS NULL AND dentist_id = v_invite.requested_by_user_id));

    -- Notify requester
    INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
    VALUES (
      v_invite.clinic_id, v_invite.requested_by_user_id,
      'patient_link',
      'Paciente entrou na plataforma',
      COALESCE(NEW.full_name, v_invite.full_name) || ' criou conta e foi vinculado(a).',
      v_invite.id, 'patient_invite'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patient_accounts_auto_accept_invites
  AFTER INSERT ON public.patient_accounts
  FOR EACH ROW EXECUTE FUNCTION public.auto_accept_patient_invites();
