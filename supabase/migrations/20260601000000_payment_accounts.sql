
-- Contas de recebimento de médicos e clínicas
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT        NOT NULL CHECK (entity_type IN ('clinic', 'doctor')),
  entity_id        UUID        NOT NULL,

  -- PIX
  pix_key_type     TEXT        CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')),
  pix_key          TEXT,

  -- Transferência bancária
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

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

-- Leitura: membros da clínica ou o próprio médico
CREATE POLICY "read_payment_accounts"
  ON public.payment_accounts FOR SELECT
  USING (
    (entity_type = 'clinic'  AND entity_id IN (
      SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  );

-- Escrita: admin/owner da clínica ou o próprio médico (conta pessoal)
CREATE POLICY "write_payment_accounts"
  ON public.payment_accounts FOR ALL
  USING (
    (entity_type = 'clinic'  AND entity_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  )
  WITH CHECK (
    (entity_type = 'clinic'  AND entity_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    ))
    OR
    (entity_type = 'doctor'  AND entity_id = auth.uid())
  );
