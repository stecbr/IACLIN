
-- Anamnese table
CREATE TABLE public.anamneses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES public.clinics(id),
  allergies TEXT,
  medications TEXT,
  medical_conditions TEXT,
  habits TEXT,
  blood_type TEXT,
  notes TEXT,
  filled_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view anamneses"
ON public.anamneses FOR SELECT TO authenticated
USING ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert anamneses"
ON public.anamneses FOR INSERT TO authenticated
WITH CHECK ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update anamneses"
ON public.anamneses FOR UPDATE TO authenticated
USING ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE TRIGGER update_anamneses_updated_at
BEFORE UPDATE ON public.anamneses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for patient files (x-rays, photos, documents)
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-files', 'patient-files', true);

CREATE POLICY "Authenticated users can upload patient files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-files');

CREATE POLICY "Anyone can view patient files"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-files');

CREATE POLICY "Authenticated users can delete patient files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-files');

-- Add labels column to appointments for appointment labels/tags
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS label TEXT;
