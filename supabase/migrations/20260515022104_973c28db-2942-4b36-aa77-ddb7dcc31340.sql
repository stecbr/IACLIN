
-- =====================================================
-- consultation_recordings
-- =====================================================
CREATE TABLE IF NOT EXISTS public.consultation_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinical_record_id UUID REFERENCES public.clinical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  dentist_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  audio_storage_path TEXT,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recording', -- recording | uploaded | processing | done | failed
  error_message TEXT,
  transcript TEXT,
  summary TEXT,
  hypotheses JSONB,
  soap JSONB,
  anamnesis JSONB,
  structured JSONB, -- payload completo da IA (chief_complaint, hpi, requests, etc.)
  consent_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultation_recordings_appointment ON public.consultation_recordings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_recordings_patient ON public.consultation_recordings(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_recordings_clinic ON public.consultation_recordings(clinic_id);

ALTER TABLE public.consultation_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members or owner can view recordings"
  ON public.consultation_recordings FOR SELECT TO authenticated
  USING (
    ((clinic_id IS NOT NULL) AND user_belongs_to_clinic(auth.uid(), clinic_id))
    OR ((clinic_id IS NULL) AND (dentist_id = auth.uid()))
  );

CREATE POLICY "Patients can view own recordings"
  ON public.consultation_recordings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = consultation_recordings.patient_id
      AND p.patient_user_id = auth.uid()
  ));

CREATE POLICY "Clinic members or owner can insert recordings"
  ON public.consultation_recordings FOR INSERT TO authenticated
  WITH CHECK (
    ((clinic_id IS NOT NULL) AND user_belongs_to_clinic(auth.uid(), clinic_id))
    OR ((clinic_id IS NULL) AND (dentist_id = auth.uid()))
  );

CREATE POLICY "Clinic members or owner can update recordings"
  ON public.consultation_recordings FOR UPDATE TO authenticated
  USING (
    ((clinic_id IS NOT NULL) AND user_belongs_to_clinic(auth.uid(), clinic_id))
    OR ((clinic_id IS NULL) AND (dentist_id = auth.uid()))
  );

CREATE POLICY "Admins can delete recordings"
  ON public.consultation_recordings FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_consultation_recordings_updated_at
  BEFORE UPDATE ON public.consultation_recordings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- user_consents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB,
  UNIQUE (user_id, consent_type)
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON public.user_consents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own consents"
  ON public.user_consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own consents"
  ON public.user_consents FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- storage bucket: consultation-audio (privado)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('consultation-audio', 'consultation-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Estrutura de pasta: <dentist_id>/<recording_id>.webm
CREATE POLICY "Recording owner can read audio"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'consultation-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Recording owner can upload audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consultation-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Recording owner can update audio"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'consultation-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Recording owner can delete audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'consultation-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
