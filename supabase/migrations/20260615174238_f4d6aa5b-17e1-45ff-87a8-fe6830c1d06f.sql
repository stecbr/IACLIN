CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  dentist_id uuid NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('after_procedure','after_payment')),
  type text NOT NULL CHECK (type IN ('percentage','fixed')),
  value numeric NOT NULL CHECK (value > 0),
  insurance_provider text,
  specialty text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX commission_rules_clinic_dentist_idx ON public.commission_rules(clinic_id, dentist_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

-- Any clinic member can read the rules
CREATE POLICY "Clinic members can read commission rules"
  ON public.commission_rules FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_clinic(auth.uid(), clinic_id));

-- Only admin or secretary roles in the clinic can write
CREATE POLICY "Clinic admins/secretaries manage commission rules"
  ON public.commission_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.clinic_id = commission_rules.clinic_id
        AND (cm.role IN ('admin','secretary') OR cm.is_owner = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.clinic_id = commission_rules.clinic_id
        AND (cm.role IN ('admin','secretary') OR cm.is_owner = true)
    )
  );

CREATE TRIGGER update_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();