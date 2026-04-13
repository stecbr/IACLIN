
-- Clinical records table (one per appointment/attendance)
CREATE TABLE public.clinical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  dentist_id UUID NOT NULL,
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
  notes TEXT,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view clinical records"
  ON public.clinical_records FOR SELECT TO authenticated
  USING ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert clinical records"
  ON public.clinical_records FOR INSERT TO authenticated
  WITH CHECK ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update clinical records"
  ON public.clinical_records FOR UPDATE TO authenticated
  USING ((clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete clinical records"
  ON public.clinical_records FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Procedures performed during attendance
CREATE TABLE public.clinical_record_procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinical_record_id UUID NOT NULL REFERENCES public.clinical_records(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES public.procedures(id),
  tooth_number INTEGER,
  surface TEXT,
  notes TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_record_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view record procedures"
  ON public.clinical_record_procedures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinical_records cr
    WHERE cr.id = clinical_record_id
    AND ((cr.clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), cr.clinic_id))
  ));

CREATE POLICY "Clinic members can insert record procedures"
  ON public.clinical_record_procedures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinical_records cr
    WHERE cr.id = clinical_record_id
    AND ((cr.clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), cr.clinic_id))
  ));

CREATE POLICY "Clinic members can update record procedures"
  ON public.clinical_record_procedures FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinical_records cr
    WHERE cr.id = clinical_record_id
    AND ((cr.clinic_id IS NULL) OR user_belongs_to_clinic(auth.uid(), cr.clinic_id))
  ));

CREATE POLICY "Admins can delete record procedures"
  ON public.clinical_record_procedures FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_clinical_records_updated_at
  BEFORE UPDATE ON public.clinical_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
