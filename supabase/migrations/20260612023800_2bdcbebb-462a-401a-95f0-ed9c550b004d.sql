
CREATE TABLE public.operator_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  card_number text NOT NULL,
  plan_name text,
  plan_type text NOT NULL DEFAULT 'individual' CHECK (plan_type IN ('individual','familiar','empresarial')),
  status text NOT NULL DEFAULT 'em_dia' CHECK (status IN ('em_dia','inadimplente','suspenso','cancelado')),
  due_day int CHECK (due_day BETWEEN 1 AND 31),
  last_payment_at date,
  next_due_date date,
  phone text,
  email text,
  date_of_birth date,
  enrolled_at date DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_op_benef_operator ON public.operator_beneficiaries(operator_id);
CREATE INDEX idx_op_benef_cpf ON public.operator_beneficiaries(cpf);
CREATE INDEX idx_op_benef_card ON public.operator_beneficiaries(card_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_beneficiaries TO authenticated;
GRANT ALL ON public.operator_beneficiaries TO service_role;
ALTER TABLE public.operator_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operator members view beneficiaries" ON public.operator_beneficiaries
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_operator(auth.uid(), operator_id));
CREATE POLICY "Operator members insert beneficiaries" ON public.operator_beneficiaries
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_operator(auth.uid(), operator_id));
CREATE POLICY "Operator members update beneficiaries" ON public.operator_beneficiaries
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_operator(auth.uid(), operator_id));
CREATE POLICY "Operator members delete beneficiaries" ON public.operator_beneficiaries
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_operator(auth.uid(), operator_id));

CREATE TRIGGER set_op_benef_updated_at BEFORE UPDATE ON public.operator_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.operator_beneficiary_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES public.operator_beneficiaries(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  card_number text,
  relationship text NOT NULL DEFAULT 'outro' CHECK (relationship IN ('conjuge','filho','filha','pai','mae','outro')),
  date_of_birth date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_op_benef_dep_benef ON public.operator_beneficiary_dependents(beneficiary_id);
CREATE INDEX idx_op_benef_dep_cpf ON public.operator_beneficiary_dependents(cpf);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_beneficiary_dependents TO authenticated;
GRANT ALL ON public.operator_beneficiary_dependents TO service_role;
ALTER TABLE public.operator_beneficiary_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operator members view dependents" ON public.operator_beneficiary_dependents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operator_beneficiaries b
    WHERE b.id = beneficiary_id AND public.user_belongs_to_operator(auth.uid(), b.operator_id)
  ));
CREATE POLICY "Operator members insert dependents" ON public.operator_beneficiary_dependents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.operator_beneficiaries b
    WHERE b.id = beneficiary_id AND public.user_belongs_to_operator(auth.uid(), b.operator_id)
  ));
CREATE POLICY "Operator members update dependents" ON public.operator_beneficiary_dependents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operator_beneficiaries b
    WHERE b.id = beneficiary_id AND public.user_belongs_to_operator(auth.uid(), b.operator_id)
  ));
CREATE POLICY "Operator members delete dependents" ON public.operator_beneficiary_dependents
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operator_beneficiaries b
    WHERE b.id = beneficiary_id AND public.user_belongs_to_operator(auth.uid(), b.operator_id)
  ));

CREATE TRIGGER set_op_benef_dep_updated_at BEFORE UPDATE ON public.operator_beneficiary_dependents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
