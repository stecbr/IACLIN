
-- =========================================================
-- 1) ENUMS
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.plan_segment AS ENUM ('clinic', 'doctor', 'operator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('card', 'pix', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sub_status AS ENUM ('active', 'trial', 'overdue', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.entity_type AS ENUM ('clinic', 'doctor', 'operator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 2) Função auxiliar: é superadmin?
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'iaclin@gmail.com'
$$;

-- =========================================================
-- 3) platform_plans
-- =========================================================
CREATE TABLE public.platform_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  segment public.plan_segment NOT NULL,
  billing_cycle public.billing_cycle NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;

ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active plans visible to authenticated"
  ON public.platform_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_platform_admin());

CREATE POLICY "Admin manages plans"
  ON public.platform_plans FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- =========================================================
-- 4) platform_coupons
-- =========================================================
CREATE TABLE public.platform_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type public.discount_type NOT NULL,
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_coupons TO authenticated;
GRANT ALL ON public.platform_coupons TO service_role;

ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages coupons"
  ON public.platform_coupons FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Authenticated can validate coupon by code"
  ON public.platform_coupons FOR SELECT
  TO authenticated
  USING (is_active = true);

-- =========================================================
-- 5) platform_subscriptions
-- =========================================================
CREATE TABLE public.platform_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type public.entity_type NOT NULL,
  entity_id UUID NOT NULL,
  plan_id UUID REFERENCES public.platform_plans(id) ON DELETE SET NULL,
  plan_name TEXT,
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'monthly',
  status public.sub_status NOT NULL DEFAULT 'trial',
  payment_method public.payment_method NOT NULL DEFAULT 'manual',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  discount_type public.discount_type,
  discount_value NUMERIC(12,2),
  coupon_id UUID REFERENCES public.platform_coupons(id) ON DELETE SET NULL,
  final_amount_cents INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end DATE,
  due_date DATE,
  last_payment_at TIMESTAMPTZ,
  last_payment_method public.payment_method,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX idx_platform_subs_entity ON public.platform_subscriptions(entity_type, entity_id);
CREATE INDEX idx_platform_subs_status ON public.platform_subscriptions(status);

GRANT SELECT ON public.platform_subscriptions TO authenticated;
GRANT ALL ON public.platform_subscriptions TO service_role;

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages subscriptions"
  ON public.platform_subscriptions FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Clinic members view own subscription"
  ON public.platform_subscriptions FOR SELECT
  TO authenticated
  USING (
    (entity_type = 'clinic'   AND public.user_belongs_to_clinic(auth.uid(), entity_id))
    OR (entity_type = 'doctor'   AND entity_id = auth.uid())
    OR (entity_type = 'operator' AND public.user_belongs_to_operator(auth.uid(), entity_id))
  );

-- =========================================================
-- 6) platform_payments
-- =========================================================
CREATE TABLE public.platform_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.platform_subscriptions(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  due_date DATE,
  stripe_invoice_id TEXT,
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_payments_sub ON public.platform_payments(subscription_id);
CREATE INDEX idx_platform_payments_status ON public.platform_payments(status);

GRANT SELECT ON public.platform_payments TO authenticated;
GRANT ALL ON public.platform_payments TO service_role;

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages payments"
  ON public.platform_payments FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Entity members view own payments"
  ON public.platform_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_subscriptions s
      WHERE s.id = subscription_id AND (
        (s.entity_type = 'clinic'   AND public.user_belongs_to_clinic(auth.uid(), s.entity_id))
        OR (s.entity_type = 'doctor'   AND s.entity_id = auth.uid())
        OR (s.entity_type = 'operator' AND public.user_belongs_to_operator(auth.uid(), s.entity_id))
      )
    )
  );

-- =========================================================
-- 7) Helpers: cálculo de valor final
-- =========================================================
CREATE OR REPLACE FUNCTION public.calc_final_amount(
  _base_cents INTEGER,
  _discount_type public.discount_type,
  _discount_value NUMERIC
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(0,
    CASE
      WHEN _discount_type IS NULL OR _discount_value IS NULL THEN _base_cents
      WHEN _discount_type = 'percent' THEN
        FLOOR(_base_cents * (1 - LEAST(_discount_value, 100) / 100.0))::int
      WHEN _discount_type = 'fixed' THEN
        _base_cents - FLOOR(_discount_value * 100)::int
      ELSE _base_cents
    END
  )
$$;

-- Trigger: ao salvar subscription, calcular final_amount_cents
CREATE OR REPLACE FUNCTION public.tg_subscription_compute_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan_price INTEGER;
  v_disc_type public.discount_type;
  v_disc_value NUMERIC;
BEGIN
  IF NEW.plan_id IS NOT NULL THEN
    SELECT price_cents INTO v_plan_price FROM public.platform_plans WHERE id = NEW.plan_id;
    IF v_plan_price IS NOT NULL THEN
      NEW.amount_cents := v_plan_price;
    END IF;
  END IF;

  -- Cupom tem prioridade sobre desconto manual
  IF NEW.coupon_id IS NOT NULL THEN
    SELECT discount_type, discount_value INTO v_disc_type, v_disc_value
      FROM public.platform_coupons WHERE id = NEW.coupon_id;
  ELSE
    v_disc_type := NEW.discount_type;
    v_disc_value := NEW.discount_value;
  END IF;

  NEW.final_amount_cents := public.calc_final_amount(NEW.amount_cents, v_disc_type, v_disc_value);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscription_compute_amount
  BEFORE INSERT OR UPDATE ON public.platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_compute_amount();

-- Trigger: ao pagar, estender vencimento e marcar último pagamento
CREATE OR REPLACE FUNCTION public.tg_payment_extend_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.billing_cycle;
  v_base DATE;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT billing_cycle, COALESCE(current_period_end, CURRENT_DATE)
      INTO v_cycle, v_base
      FROM public.platform_subscriptions WHERE id = NEW.subscription_id;

    UPDATE public.platform_subscriptions
      SET last_payment_at = COALESCE(NEW.paid_at, now()),
          last_payment_method = NEW.method,
          current_period_end = (GREATEST(v_base, CURRENT_DATE)
            + CASE WHEN v_cycle = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END)::date,
          status = 'active',
          updated_at = now()
      WHERE id = NEW.subscription_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_extend_period
  AFTER INSERT OR UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_extend_period();

-- updated_at triggers
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.platform_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.platform_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 8) RPC: upsert_platform_subscription
-- =========================================================
CREATE OR REPLACE FUNCTION public.upsert_platform_subscription(
  p_entity_type public.entity_type,
  p_entity_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_billing_cycle public.billing_cycle DEFAULT 'monthly',
  p_status public.sub_status DEFAULT 'trial',
  p_payment_method public.payment_method DEFAULT 'manual',
  p_discount_type public.discount_type DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL,
  p_coupon_id UUID DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.platform_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_name TEXT;
  v_row public.platform_subscriptions;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_plan_name FROM public.platform_plans WHERE id = p_plan_id;

  INSERT INTO public.platform_subscriptions AS s (
    entity_type, entity_id, plan_id, plan_name, billing_cycle, status,
    payment_method, discount_type, discount_value, coupon_id, due_date, notes
  ) VALUES (
    p_entity_type, p_entity_id, p_plan_id, v_plan_name, p_billing_cycle, p_status,
    p_payment_method, p_discount_type, p_discount_value, p_coupon_id, p_due_date, p_notes
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    plan_name = EXCLUDED.plan_name,
    billing_cycle = EXCLUDED.billing_cycle,
    status = EXCLUDED.status,
    payment_method = EXCLUDED.payment_method,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    coupon_id = EXCLUDED.coupon_id,
    due_date = EXCLUDED.due_date,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =========================================================
-- 9) RPC: record_pix_payment (registro manual pelo admin)
-- =========================================================
CREATE OR REPLACE FUNCTION public.record_pix_payment(
  p_subscription_id UUID,
  p_amount_cents INTEGER,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_receipt_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.platform_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_payments;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_payments (
    subscription_id, amount_cents, method, status, paid_at, receipt_url, notes, recorded_by
  ) VALUES (
    p_subscription_id, p_amount_cents, 'pix', 'paid', p_paid_at, p_receipt_url, p_notes, auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
