CREATE TABLE public.professional_blocked_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clinic_id uuid NULL,
  blocked_date date NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX professional_blocked_dates_unique
  ON public.professional_blocked_dates (user_id, COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), blocked_date);

CREATE INDEX professional_blocked_dates_lookup
  ON public.professional_blocked_dates (user_id, blocked_date);

ALTER TABLE public.professional_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked dates"
  ON public.professional_blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Owner can insert blocked dates"
  ON public.professional_blocked_dates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete blocked dates"
  ON public.professional_blocked_dates FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can update blocked dates"
  ON public.professional_blocked_dates FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());