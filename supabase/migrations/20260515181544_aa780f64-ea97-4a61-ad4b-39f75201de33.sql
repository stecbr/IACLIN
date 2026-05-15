
-- 1. Tabela ai_tenants
CREATE TABLE public.ai_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('clinic','professional')),
  clinic_id uuid NULL,
  user_id uuid NULL,
  display_name text,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_tenants_owner_consistency CHECK (
    (owner_type = 'clinic' AND clinic_id IS NOT NULL AND user_id IS NULL) OR
    (owner_type = 'professional' AND user_id IS NOT NULL AND clinic_id IS NULL)
  )
);

CREATE UNIQUE INDEX ai_tenants_unique_clinic
  ON public.ai_tenants(clinic_id) WHERE owner_type = 'clinic';
CREATE UNIQUE INDEX ai_tenants_unique_user
  ON public.ai_tenants(user_id) WHERE owner_type = 'professional';

ALTER TABLE public.ai_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own ai tenant (clinic member or self)"
  ON public.ai_tenants FOR SELECT TO authenticated
  USING (
    (owner_type = 'clinic' AND clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
    OR (owner_type = 'professional' AND user_id = auth.uid())
  );

CREATE POLICY "Insert own ai tenant"
  ON public.ai_tenants FOR INSERT TO authenticated
  WITH CHECK (
    (owner_type = 'clinic' AND clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
    OR (owner_type = 'professional' AND user_id = auth.uid())
  );

CREATE POLICY "Update own ai tenant"
  ON public.ai_tenants FOR UPDATE TO authenticated
  USING (
    (owner_type = 'clinic' AND clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id))
    OR (owner_type = 'professional' AND user_id = auth.uid())
  );

CREATE POLICY "Admins can delete ai tenants"
  ON public.ai_tenants FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ai_tenants_updated_at
  BEFORE UPDATE ON public.ai_tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Funções de resolução
CREATE OR REPLACE FUNCTION public.resolve_or_create_ai_tenant_for_clinic(_clinic_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_clinic_name text;
BEGIN
  SELECT id INTO v_tenant_id FROM public.ai_tenants
    WHERE owner_type = 'clinic' AND clinic_id = _clinic_id LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;

  SELECT name INTO v_clinic_name FROM public.clinics WHERE id = _clinic_id;
  INSERT INTO public.ai_tenants(owner_type, clinic_id, display_name)
    VALUES ('clinic', _clinic_id, v_clinic_name)
    RETURNING id INTO v_tenant_id;
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_or_create_ai_tenant_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_full_name text;
BEGIN
  SELECT id INTO v_tenant_id FROM public.ai_tenants
    WHERE owner_type = 'professional' AND user_id = _user_id LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;

  SELECT full_name INTO v_full_name FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.ai_tenants(owner_type, user_id, display_name)
    VALUES ('professional', _user_id, v_full_name)
    RETURNING id INTO v_tenant_id;
  RETURN v_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_owns_ai_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_tenants t
    WHERE t.id = _tenant_id
      AND (
        (t.owner_type = 'professional' AND t.user_id = _user_id)
        OR (t.owner_type = 'clinic' AND public.user_belongs_to_clinic(_user_id, t.clinic_id))
      )
  );
$$;

-- 3. Backfill: 1 ai_tenant por clínica existente
INSERT INTO public.ai_tenants(owner_type, clinic_id, display_name)
SELECT 'clinic', c.id, c.name
  FROM public.clinics c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ai_tenants t
    WHERE t.owner_type = 'clinic' AND t.clinic_id = c.id
  );

-- 4. Adicionar ai_tenant_id (nullable) nas tabelas de IA
ALTER TABLE public.ai_secretary_config ADD COLUMN ai_tenant_id uuid NULL;
ALTER TABLE public.ai_secretary_handoff ADD COLUMN ai_tenant_id uuid NULL;
ALTER TABLE public.whatsapp_messages   ADD COLUMN ai_tenant_id uuid NULL;

CREATE INDEX idx_ai_secretary_config_tenant  ON public.ai_secretary_config(ai_tenant_id);
CREATE INDEX idx_ai_secretary_handoff_tenant ON public.ai_secretary_handoff(ai_tenant_id);
CREATE INDEX idx_whatsapp_messages_tenant    ON public.whatsapp_messages(ai_tenant_id);

-- Backfill com tenants das clínicas
UPDATE public.ai_secretary_config SET ai_tenant_id = t.id
  FROM public.ai_tenants t
  WHERE t.owner_type = 'clinic' AND t.clinic_id = ai_secretary_config.clinic_id
    AND ai_secretary_config.ai_tenant_id IS NULL;

UPDATE public.ai_secretary_handoff SET ai_tenant_id = t.id
  FROM public.ai_tenants t
  WHERE t.owner_type = 'clinic' AND t.clinic_id = ai_secretary_handoff.clinic_id
    AND ai_secretary_handoff.ai_tenant_id IS NULL;

UPDATE public.whatsapp_messages SET ai_tenant_id = t.id
  FROM public.ai_tenants t
  WHERE t.owner_type = 'clinic' AND t.clinic_id = whatsapp_messages.clinic_id
    AND whatsapp_messages.ai_tenant_id IS NULL;

-- 5. Trigger: auto-popular ai_tenant_id em INSERT a partir de clinic_id
CREATE OR REPLACE FUNCTION public.auto_fill_ai_tenant_from_clinic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ai_tenant_id IS NULL AND NEW.clinic_id IS NOT NULL THEN
    NEW.ai_tenant_id := public.resolve_or_create_ai_tenant_for_clinic(NEW.clinic_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_secretary_config_fill_tenant
  BEFORE INSERT ON public.ai_secretary_config
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ai_tenant_from_clinic();

CREATE TRIGGER trg_ai_secretary_handoff_fill_tenant
  BEFORE INSERT ON public.ai_secretary_handoff
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ai_tenant_from_clinic();

CREATE TRIGGER trg_whatsapp_messages_fill_tenant
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_ai_tenant_from_clinic();
