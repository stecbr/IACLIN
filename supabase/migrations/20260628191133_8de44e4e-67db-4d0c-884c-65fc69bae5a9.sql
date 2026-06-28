
CREATE TABLE public.insurance_glosas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE RESTRICT,
  insurance_invoice_period varchar(7) NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  expected_amount numeric(10,2) NOT NULL,
  received_amount numeric(10,2) NOT NULL,
  glosa_amount   numeric(10,2) NOT NULL,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'identified'
    CHECK (status IN ('identified','accepted','contested','recovered')),
  loss_transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_glosas TO authenticated;
GRANT ALL ON public.insurance_glosas TO service_role;
ALTER TABLE public.insurance_glosas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members read glosas" ON public.insurance_glosas
  FOR SELECT TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members insert glosas" ON public.insurance_glosas
  FOR INSERT TO authenticated WITH CHECK (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members update glosas" ON public.insurance_glosas
  FOR UPDATE TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members delete glosas" ON public.insurance_glosas
  FOR DELETE TO authenticated USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_glosas_clinic_period ON public.insurance_glosas(clinic_id, operator_id, insurance_invoice_period);

CREATE TRIGGER trg_glosas_updated_at BEFORE UPDATE ON public.insurance_glosas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.reconcile_insurance_invoice(
  _clinic_id uuid,
  _operator_id uuid,
  _period varchar,
  _received_amount numeric,
  _payment_method text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _glosas jsonb DEFAULT '[]'::jsonb,
  _create_loss_transaction boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expected numeric(10,2);
  v_count int;
  v_glosa jsonb;
  v_new_glosa public.insurance_glosas;
  v_loss_tx_id uuid;
  v_created_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NOT public.user_belongs_to_clinic(auth.uid(), _clinic_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*)
    INTO v_expected, v_count
    FROM public.financial_transactions
   WHERE clinic_id = _clinic_id
     AND operator_id = _operator_id
     AND insurance_invoice_period = _period;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Lote sem transações';
  END IF;

  -- Cria glosas
  FOR v_glosa IN SELECT * FROM jsonb_array_elements(COALESCE(_glosas, '[]'::jsonb))
  LOOP
    v_loss_tx_id := NULL;

    -- Cria transação de perda se aceita
    IF _create_loss_transaction
       AND COALESCE(v_glosa->>'status','identified') = 'accepted'
       AND COALESCE((v_glosa->>'glosa_amount')::numeric, 0) > 0 THEN
      INSERT INTO public.financial_transactions (
        clinic_id, operator_id, type, category, amount, status,
        description, notes, due_date, paid_date
      ) VALUES (
        _clinic_id, _operator_id, 'expense', 'loss_glosa',
        (v_glosa->>'glosa_amount')::numeric, 'paid',
        'Glosa convênio ' || _period,
        NULLIF(v_glosa->>'reason',''),
        CURRENT_DATE, CURRENT_DATE
      ) RETURNING id INTO v_loss_tx_id;
    END IF;

    INSERT INTO public.insurance_glosas (
      clinic_id, operator_id, insurance_invoice_period,
      appointment_id, transaction_id,
      expected_amount, received_amount, glosa_amount,
      reason, status, loss_transaction_id, created_by
    ) VALUES (
      _clinic_id, _operator_id, _period,
      NULLIF(v_glosa->>'appointment_id','')::uuid,
      NULLIF(v_glosa->>'transaction_id','')::uuid,
      v_expected, _received_amount,
      COALESCE((v_glosa->>'glosa_amount')::numeric, 0),
      NULLIF(v_glosa->>'reason',''),
      COALESCE(v_glosa->>'status', 'identified'),
      v_loss_tx_id, auth.uid()
    ) RETURNING * INTO v_new_glosa;

    v_created_ids := array_append(v_created_ids, v_new_glosa.id);
  END LOOP;

  -- Marca todas as transações do lote como pagas/conciliadas
  UPDATE public.financial_transactions
     SET status = 'paid',
         paid_date = COALESCE(paid_date, CURRENT_DATE),
         insurance_invoice_status = 'reconciled',
         payment_method = COALESCE(_payment_method, payment_method),
         notes = COALESCE(notes,'') ||
           CASE WHEN _notes IS NOT NULL AND _notes <> ''
                THEN E'\n[Conciliação ' || to_char(now(),'DD/MM/YYYY') || ']: ' || _notes
                ELSE '' END,
         updated_at = now()
   WHERE clinic_id = _clinic_id
     AND operator_id = _operator_id
     AND insurance_invoice_period = _period;

  RETURN jsonb_build_object(
    'expected', v_expected,
    'received', _received_amount,
    'glosa_count', array_length(v_created_ids, 1),
    'glosa_ids', to_jsonb(v_created_ids)
  );
END $$;
