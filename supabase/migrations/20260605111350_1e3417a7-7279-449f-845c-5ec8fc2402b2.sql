
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT        NOT NULL CHECK (entity_type IN ('clinic', 'doctor')),
  entity_id        UUID        NOT NULL,
  pix_key_type     TEXT        CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_key          TEXT,
  bank_name        TEXT,
  bank_code        TEXT,
  agency           TEXT,
  agency_digit     TEXT,
  account          TEXT,
  account_digit    TEXT,
  account_type     TEXT        CHECK (account_type IN ('corrente', 'poupanca')),
  account_holder   TEXT,
  account_holder_doc TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_payment_accounts" ON public.payment_accounts;
DROP POLICY IF EXISTS "write_payment_accounts" ON public.payment_accounts;

CREATE POLICY "read_payment_accounts"
  ON public.payment_accounts FOR SELECT
  TO authenticated
  USING (
    (entity_type = 'clinic'  AND entity_id IN (
      SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  );

CREATE POLICY "write_payment_accounts"
  ON public.payment_accounts FOR ALL
  TO authenticated
  USING (
    (entity_type = 'clinic'  AND (
      public.is_clinic_owner(auth.uid(), entity_id)
      OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), entity_id))
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  )
  WITH CHECK (
    (entity_type = 'clinic'  AND (
      public.is_clinic_owner(auth.uid(), entity_id)
      OR (public.has_role(auth.uid(), 'admin'::app_role) AND public.user_belongs_to_clinic(auth.uid(), entity_id))
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.payment_accounts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_payment_accounts_updated_at ON public.payment_accounts;
CREATE TRIGGER trg_payment_accounts_updated_at
  BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.payment_accounts_set_updated_at();

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS category_label TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS neighborhood TEXT;

NOTIFY pgrst, 'reload schema';
