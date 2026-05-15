-- 1) Tornar clinic_id nullable nas tabelas da IA (modo profissional não tem clínica)
ALTER TABLE public.ai_secretary_config ALTER COLUMN clinic_id DROP NOT NULL;
ALTER TABLE public.ai_secretary_handoff ALTER COLUMN clinic_id DROP NOT NULL;

-- 2) Garantir 1 config / 1 handoff por tenant da IA (quando ai_tenant_id presente)
CREATE UNIQUE INDEX IF NOT EXISTS ai_secretary_config_ai_tenant_uniq
  ON public.ai_secretary_config(ai_tenant_id)
  WHERE ai_tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_secretary_handoff_ai_tenant_uniq
  ON public.ai_secretary_handoff(ai_tenant_id)
  WHERE ai_tenant_id IS NOT NULL;

-- 3) Policies novas (lado a lado com as antigas) baseadas em ai_tenant_id
-- ai_secretary_config
CREATE POLICY "Tenant owners can view ai config"
  ON public.ai_secretary_config FOR SELECT TO authenticated
  USING (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));

CREATE POLICY "Tenant owners can insert ai config"
  ON public.ai_secretary_config FOR INSERT TO authenticated
  WITH CHECK (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));

CREATE POLICY "Tenant owners can update ai config"
  ON public.ai_secretary_config FOR UPDATE TO authenticated
  USING (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));

-- ai_secretary_handoff
CREATE POLICY "Tenant owners can view handoff"
  ON public.ai_secretary_handoff FOR SELECT TO authenticated
  USING (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));

CREATE POLICY "Tenant owners can insert handoff"
  ON public.ai_secretary_handoff FOR INSERT TO authenticated
  WITH CHECK (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));

CREATE POLICY "Tenant owners can update handoff"
  ON public.ai_secretary_handoff FOR UPDATE TO authenticated
  USING (ai_tenant_id IS NOT NULL AND public.user_owns_ai_tenant(auth.uid(), ai_tenant_id));