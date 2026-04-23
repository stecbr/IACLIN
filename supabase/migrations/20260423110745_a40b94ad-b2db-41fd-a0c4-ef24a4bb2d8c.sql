-- Create clinical_map_entries: generalized version of odontogram_entries
CREATE TABLE public.clinical_map_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  clinic_id UUID,
  dentist_id UUID,
  appointment_id UUID,
  map_type TEXT NOT NULL CHECK (map_type IN ('tooth', 'foot', 'body', 'meal', 'musculoskeletal')),
  region_code TEXT NOT NULL,
  condition TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  notes TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinical_map_entries_patient ON public.clinical_map_entries(patient_id);
CREATE INDEX idx_clinical_map_entries_clinic ON public.clinical_map_entries(clinic_id);
CREATE INDEX idx_clinical_map_entries_appointment ON public.clinical_map_entries(appointment_id);
CREATE INDEX idx_clinical_map_entries_map_type ON public.clinical_map_entries(map_type);

ALTER TABLE public.clinical_map_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view clinical map entries"
ON public.clinical_map_entries
FOR SELECT
TO authenticated
USING (clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert clinical map entries"
ON public.clinical_map_entries
FOR INSERT
TO authenticated
WITH CHECK (clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update clinical map entries"
ON public.clinical_map_entries
FOR UPDATE
TO authenticated
USING (clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can delete clinical map entries"
ON public.clinical_map_entries
FOR DELETE
TO authenticated
USING (clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Patients can view own clinical map entries"
ON public.clinical_map_entries
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.patients p
  WHERE p.id = clinical_map_entries.patient_id
  AND p.patient_user_id = auth.uid()
));

CREATE TRIGGER update_clinical_map_entries_updated_at
BEFORE UPDATE ON public.clinical_map_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing odontogram_entries into the new table
INSERT INTO public.clinical_map_entries (
  patient_id, dentist_id, map_type, region_code, condition, notes, created_at, updated_at
)
SELECT
  patient_id,
  dentist_id,
  'tooth',
  'tooth-' || tooth_number::text || COALESCE('-' || surface, ''),
  condition,
  notes,
  created_at,
  updated_at
FROM public.odontogram_entries
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinical_map_entries cme
  WHERE cme.patient_id = odontogram_entries.patient_id
    AND cme.region_code = 'tooth-' || odontogram_entries.tooth_number::text || COALESCE('-' || odontogram_entries.surface, '')
    AND cme.created_at = odontogram_entries.created_at
);