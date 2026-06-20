ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS appointment_id uuid;
CREATE INDEX IF NOT EXISTS idx_documents_appointment_id ON public.documents(appointment_id);