
-- Add business_hours JSON column to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"mon":{"open":"08:00","close":"18:00","enabled":true},"tue":{"open":"08:00","close":"18:00","enabled":true},"wed":{"open":"08:00","close":"18:00","enabled":true},"thu":{"open":"08:00","close":"18:00","enabled":true},"fri":{"open":"08:00","close":"18:00","enabled":true},"sat":{"open":"08:00","close":"12:00","enabled":false},"sun":{"open":"08:00","close":"12:00","enabled":false}}'::jsonb;

-- Storage bucket for clinic assets (logos)
INSERT INTO storage.buckets (id, name, public) VALUES ('clinic-assets', 'clinic-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload clinic assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinic-assets');

CREATE POLICY "Anyone can view clinic assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'clinic-assets');

CREATE POLICY "Authenticated users can update clinic assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clinic-assets');

-- Insurance plans table
CREATE TABLE public.insurance_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ans_code TEXT,
  type TEXT NOT NULL DEFAULT 'dental',
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view insurance plans"
ON public.insurance_plans FOR SELECT TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert insurance plans"
ON public.insurance_plans FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update insurance plans"
ON public.insurance_plans FOR UPDATE TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete insurance plans"
ON public.insurance_plans FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_insurance_plans_updated_at
BEFORE UPDATE ON public.insurance_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
