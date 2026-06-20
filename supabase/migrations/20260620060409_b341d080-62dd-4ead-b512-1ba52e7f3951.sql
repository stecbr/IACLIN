
CREATE TABLE public.nps_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  question text NOT NULL,
  scale_min smallint NOT NULL DEFAULT 0,
  scale_max smallint NOT NULL DEFAULT 10,
  send_after_hours smallint NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nps_surveys_clinic_active_idx ON public.nps_surveys (clinic_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_surveys TO authenticated;
GRANT ALL ON public.nps_surveys TO service_role;

ALTER TABLE public.nps_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY nps_surveys_select_by_clinic ON public.nps_surveys
  FOR SELECT USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_surveys_insert_by_clinic ON public.nps_surveys
  FOR INSERT WITH CHECK (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_surveys_update_by_clinic ON public.nps_surveys
  FOR UPDATE USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_surveys_delete_by_clinic ON public.nps_surveys
  FOR DELETE USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE TRIGGER update_nps_surveys_updated_at
  BEFORE UPDATE ON public.nps_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  survey_id uuid REFERENCES public.nps_surveys(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_phone text,
  score smallint,
  comment text,
  category text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX nps_responses_clinic_sent_idx ON public.nps_responses (clinic_id, sent_at DESC);
CREATE UNIQUE INDEX nps_responses_appointment_unique ON public.nps_responses (appointment_id) WHERE appointment_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nps_responses TO authenticated;
GRANT ALL ON public.nps_responses TO service_role;

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY nps_responses_select_by_clinic ON public.nps_responses
  FOR SELECT USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_responses_insert_by_clinic ON public.nps_responses
  FOR INSERT WITH CHECK (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_responses_update_by_clinic ON public.nps_responses
  FOR UPDATE USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY nps_responses_delete_by_clinic ON public.nps_responses
  FOR DELETE USING (clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), clinic_id));
