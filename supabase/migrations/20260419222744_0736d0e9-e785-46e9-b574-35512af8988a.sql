-- 1. Add specialty column to clinic_members
ALTER TABLE public.clinic_members
ADD COLUMN IF NOT EXISTS specialty text;

-- 2. Create professional_availability table
CREATE TABLE IF NOT EXISTS public.professional_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  user_id uuid NOT NULL,
  work_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_holiday_override boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT professional_availability_time_check CHECK (end_time > start_time),
  CONSTRAINT professional_availability_unique UNIQUE (user_id, work_date, start_time)
);

CREATE INDEX IF NOT EXISTS idx_prof_avail_clinic_date
  ON public.professional_availability (clinic_id, work_date);
CREATE INDEX IF NOT EXISTS idx_prof_avail_user_date
  ON public.professional_availability (user_id, work_date);

-- 3. Enable RLS
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Anyone (anon + auth) can read availability — needed for booking & marketplace
CREATE POLICY "Anyone can view availability"
  ON public.professional_availability
  FOR SELECT
  USING (true);

-- Clinic members can insert their own availability
CREATE POLICY "Clinic members can insert availability"
  ON public.professional_availability
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_belongs_to_clinic(auth.uid(), clinic_id)
    AND user_id = auth.uid()
  );

-- Clinic members can update their own availability
CREATE POLICY "Clinic members can update own availability"
  ON public.professional_availability
  FOR UPDATE
  TO authenticated
  USING (
    user_belongs_to_clinic(auth.uid(), clinic_id)
    AND user_id = auth.uid()
  );

-- Clinic members can delete their own availability
CREATE POLICY "Clinic members can delete own availability"
  ON public.professional_availability
  FOR DELETE
  TO authenticated
  USING (
    user_belongs_to_clinic(auth.uid(), clinic_id)
    AND user_id = auth.uid()
  );

-- 5. updated_at trigger
CREATE TRIGGER trg_prof_avail_updated_at
  BEFORE UPDATE ON public.professional_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();