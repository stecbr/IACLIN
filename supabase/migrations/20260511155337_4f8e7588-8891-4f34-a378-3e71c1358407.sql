-- Weekly schedule template per professional
CREATE TABLE IF NOT EXISTS public.professional_schedule_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NULL, -- NULL = personal/particular workspace
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '18:00',
  breaks jsonb NOT NULL DEFAULT '[]'::jsonb,
  mode text NOT NULL DEFAULT 'ambos' CHECK (mode IN ('particular','plano','ambos')),
  accepted_plan_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_template_user_scope_weekday
  ON public.professional_schedule_template (user_id, COALESCE(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);

ALTER TABLE public.professional_schedule_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view templates"
  ON public.professional_schedule_template FOR SELECT
  USING (true);

CREATE POLICY "Owner can insert own template"
  ON public.professional_schedule_template FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (clinic_id IS NULL OR public.user_belongs_to_clinic(auth.uid(), clinic_id))
  );

CREATE POLICY "Owner can update own template"
  ON public.professional_schedule_template FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner can delete own template"
  ON public.professional_schedule_template FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_schedule_template_updated_at
  BEFORE UPDATE ON public.professional_schedule_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-professional settings (duration, buffer, lead time)
CREATE TABLE IF NOT EXISTS public.professional_settings (
  user_id uuid PRIMARY KEY,
  default_slot_duration smallint NOT NULL DEFAULT 30,
  buffer_minutes smallint NOT NULL DEFAULT 0,
  min_lead_hours smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view professional settings"
  ON public.professional_settings FOR SELECT USING (true);

CREATE POLICY "Owner can upsert own settings"
  ON public.professional_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update own settings"
  ON public.professional_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_professional_settings_updated_at
  BEFORE UPDATE ON public.professional_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exception overrides (date-specific) - add columns to existing table
ALTER TABLE public.professional_availability
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'ambos' CHECK (mode IN ('particular','plano','ambos')),
  ADD COLUMN IF NOT EXISTS breaks jsonb NOT NULL DEFAULT '[]'::jsonb;
