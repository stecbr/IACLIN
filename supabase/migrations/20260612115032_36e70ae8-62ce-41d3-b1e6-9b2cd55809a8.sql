
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS landline TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS categories TEXT[],
  ADD COLUMN IF NOT EXISTS sms_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_cpf TEXT,
  ADD COLUMN IF NOT EXISTS guardian_date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS insurance_holder TEXT,
  ADD COLUMN IF NOT EXISTS insurance_holder_cpf TEXT;

NOTIFY pgrst, 'reload schema';
