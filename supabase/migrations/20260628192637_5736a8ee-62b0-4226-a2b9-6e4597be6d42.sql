-- Block 4: Card fees, operational flag, and DRE summary RPC

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS card_fee_amount numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS is_operational boolean
  GENERATED ALWAYS AS (
    type = 'expense'
    AND category NOT IN ('commission','loss_glosa','card_fee')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_ft_operational
  ON public.financial_transactions(clinic_id, is_operational, due_date);

CREATE INDEX IF NOT EXISTS idx_ft_card_fee
  ON public.financial_transactions(clinic_id, paid_date)
  WHERE card_fee_amount > 0;

-- DRE aggregator
CREATE OR REPLACE FUNCTION public.get_clinic_financial_summary(
  _clinic_id uuid,
  _start date,
  _end date,
  _dentist_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_monthly jsonb;
  v_totals jsonb;
BEGIN
  IF NOT public.user_belongs_to_clinic(auth.uid(), _clinic_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF _dentist_id IS NOT NULL AND _dentist_id <> auth.uid() THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clinic_members
      WHERE clinic_id = _clinic_id AND user_id = auth.uid()
        AND role IN ('admin','secretary')
    ) INTO v_is_admin;
    IF NOT COALESCE(v_is_admin, false) THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS month, d::date AS month_start,
           (d + interval '1 month - 1 day')::date AS month_end
    FROM generate_series(date_trunc('month', _start), date_trunc('month', _end), interval '1 month') d
  ),
  tx AS (
    SELECT * FROM public.financial_transactions
    WHERE clinic_id = _clinic_id
      AND (_dentist_id IS NULL OR dentist_id = _dentist_id)
  ),
  agg AS (
    SELECT
      m.month,
      COALESCE(SUM(CASE
        WHEN t.type='income' AND t.status='paid' AND t.operator_id IS NULL
         AND t.paid_date BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS revenue_particular,
      COALESCE(SUM(CASE
        WHEN t.type='income' AND t.operator_id IS NOT NULL
         AND t.insurance_invoice_status IN ('reconciled','paid')
         AND COALESCE(t.paid_date, t.updated_at::date) BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS revenue_insurance_received,
      COALESCE(SUM(CASE
        WHEN t.type='income' AND t.operator_id IS NOT NULL
         AND t.insurance_invoice_status IN ('invoiced','sent')
         AND COALESCE(t.due_date, t.created_at::date) BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS revenue_insurance_invoiced,
      COALESCE(SUM(CASE
        WHEN t.type='income' AND t.status='paid'
         AND t.paid_date BETWEEN m.month_start AND m.month_end
        THEN t.card_fee_amount END),0)
      + COALESCE(SUM(CASE
        WHEN t.type='expense' AND t.category='card_fee' AND t.status='paid'
         AND t.paid_date BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS card_fees,
      COALESCE(SUM(CASE
        WHEN t.type='expense' AND t.category='commission' AND t.status='pending'
         AND COALESCE(t.due_date, t.created_at::date) BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS commissions_pending,
      COALESCE(SUM(CASE
        WHEN t.is_operational AND t.status='paid'
         AND t.paid_date BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS operational_expenses,
      COALESCE(SUM(CASE
        WHEN t.is_operational AND t.status='pending'
         AND COALESCE(t.due_date, t.created_at::date) BETWEEN m.month_start AND m.month_end
        THEN t.amount END),0) AS operational_pending
    FROM months m
    LEFT JOIN tx t ON true
    GROUP BY m.month, m.month_start, m.month_end
  ),
  payouts AS (
    SELECT to_char(p.paid_at, 'YYYY-MM') AS month, COALESCE(SUM(p.total_amount),0) AS commissions_paid
    FROM public.commission_payouts p
    WHERE p.clinic_id = _clinic_id
      AND (_dentist_id IS NULL OR p.dentist_id = _dentist_id)
      AND p.paid_at::date BETWEEN _start AND _end
    GROUP BY 1
  ),
  glosas AS (
    SELECT to_char(g.created_at, 'YYYY-MM') AS month, COALESCE(SUM(g.glosa_amount),0) AS glosas_accepted
    FROM public.insurance_glosas g
    WHERE g.clinic_id = _clinic_id
      AND g.status = 'accepted'
      AND g.created_at::date BETWEEN _start AND _end
    GROUP BY 1
  ),
  merged AS (
    SELECT a.month,
      a.revenue_particular, a.revenue_insurance_received, a.revenue_insurance_invoiced,
      a.card_fees, a.commissions_pending, a.operational_expenses, a.operational_pending,
      COALESCE(p.commissions_paid, 0) AS commissions_paid,
      COALESCE(g.glosas_accepted, 0) AS glosas_accepted,
      (a.revenue_particular + a.revenue_insurance_received
        - a.card_fees - COALESCE(g.glosas_accepted,0)
        - COALESCE(p.commissions_paid,0) - a.operational_expenses) AS net_result
    FROM agg a
    LEFT JOIN payouts p ON p.month = a.month
    LEFT JOIN glosas  g ON g.month = a.month
    ORDER BY a.month
  )
  SELECT jsonb_agg(to_jsonb(m)) INTO v_monthly FROM merged m;

  SELECT jsonb_build_object(
    'revenue_particular',          COALESCE(SUM((x->>'revenue_particular')::numeric),0),
    'revenue_insurance_received',  COALESCE(SUM((x->>'revenue_insurance_received')::numeric),0),
    'revenue_insurance_invoiced',  COALESCE(SUM((x->>'revenue_insurance_invoiced')::numeric),0),
    'card_fees',                   COALESCE(SUM((x->>'card_fees')::numeric),0),
    'glosas_accepted',             COALESCE(SUM((x->>'glosas_accepted')::numeric),0),
    'commissions_paid',            COALESCE(SUM((x->>'commissions_paid')::numeric),0),
    'commissions_pending',         COALESCE(SUM((x->>'commissions_pending')::numeric),0),
    'operational_expenses',        COALESCE(SUM((x->>'operational_expenses')::numeric),0),
    'operational_pending',         COALESCE(SUM((x->>'operational_pending')::numeric),0),
    'net_result',                  COALESCE(SUM((x->>'net_result')::numeric),0)
  ) INTO v_totals
  FROM jsonb_array_elements(COALESCE(v_monthly,'[]'::jsonb)) x;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('start', _start, 'end', _end),
    'monthly', COALESCE(v_monthly, '[]'::jsonb),
    'totals',  COALESCE(v_totals,  '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_financial_summary(uuid, date, date, uuid) TO authenticated;