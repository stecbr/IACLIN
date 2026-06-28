
CREATE TABLE public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  transactions_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid','pending_payment','cancelled')),
  payment_method text,
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.commission_payouts TO authenticated;
GRANT ALL ON public.commission_payouts TO service_role;

ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members read payouts"
  ON public.commission_payouts FOR SELECT TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members insert payouts"
  ON public.commission_payouts FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members update payouts"
  ON public.commission_payouts FOR UPDATE TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_payouts_clinic_dentist
  ON public.commission_payouts(clinic_id, dentist_id, period_end DESC);

CREATE TRIGGER trg_commission_payouts_updated_at
  BEFORE UPDATE ON public.commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.commission_payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ft_payout_id
  ON public.financial_transactions(payout_id);

CREATE OR REPLACE FUNCTION public.close_commission_period(
  _clinic_id uuid,
  _dentist_id uuid,
  _period_start date,
  _period_end date,
  _payment_method text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS public.commission_payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(10,2);
  v_count int;
  v_payout public.commission_payouts;
BEGIN
  IF NOT public.user_belongs_to_clinic(auth.uid(), _clinic_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*)
    INTO v_total, v_count
    FROM public.financial_transactions
   WHERE clinic_id = _clinic_id
     AND dentist_id = _dentist_id
     AND type = 'expense'
     AND category = 'commission'
     AND status = 'pending'
     AND payout_id IS NULL
     AND COALESCE(due_date, created_at::date) BETWEEN _period_start AND _period_end;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma comissão pendente neste período';
  END IF;

  INSERT INTO public.commission_payouts(
    clinic_id, dentist_id, period_start, period_end,
    total_amount, transactions_count, status, payment_method, notes,
    paid_at, created_by
  ) VALUES (
    _clinic_id, _dentist_id, _period_start, _period_end,
    v_total, v_count, 'paid', _payment_method, _notes,
    now(), auth.uid()
  ) RETURNING * INTO v_payout;

  UPDATE public.financial_transactions
     SET status = 'paid',
         paid_date = CURRENT_DATE,
         payout_id = v_payout.id,
         updated_at = now()
   WHERE clinic_id = _clinic_id
     AND dentist_id = _dentist_id
     AND type = 'expense'
     AND category = 'commission'
     AND status = 'pending'
     AND payout_id IS NULL
     AND COALESCE(due_date, created_at::date) BETWEEN _period_start AND _period_end;

  INSERT INTO public.notifications(clinic_id, user_id, type, title, message, reference_id, reference_type)
  VALUES (
    _clinic_id, _dentist_id, 'financial',
    'Repasse recebido',
    'Foi registrado um repasse de R$ ' || to_char(v_total,'FM999G999G990D00') ||
      ' referente ao período ' || to_char(_period_start,'DD/MM') || '–' || to_char(_period_end,'DD/MM/YYYY') || '.',
    v_payout.id, 'commission_payout'
  );

  RETURN v_payout;
END $$;
