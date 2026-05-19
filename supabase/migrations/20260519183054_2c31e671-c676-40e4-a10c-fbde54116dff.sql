
-- Patient chart shares: temporary access codes for sharing full patient EHR
CREATE TABLE public.patient_chart_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  clinic_id uuid,
  created_by uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_chart_shares_code ON public.patient_chart_shares(code);
CREATE INDEX idx_patient_chart_shares_patient ON public.patient_chart_shares(patient_id);

ALTER TABLE public.patient_chart_shares ENABLE ROW LEVEL SECURITY;

-- Only clinic members can create shares for patients of their clinic
CREATE POLICY "Clinic members can insert chart shares"
  ON public.patient_chart_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
      OR (clinic_id IS NULL AND created_by = auth.uid())
    )
  );

CREATE POLICY "Clinic members can view chart shares"
  ON public.patient_chart_shares
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR (clinic_id IS NOT NULL AND user_belongs_to_clinic(auth.uid(), clinic_id))
  );

CREATE POLICY "Admins can delete chart shares"
  ON public.patient_chart_shares
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
