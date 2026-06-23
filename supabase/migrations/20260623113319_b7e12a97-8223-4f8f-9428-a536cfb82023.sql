ALTER TABLE public.ai_appointment_requests
  ADD COLUMN IF NOT EXISTS patient_cpf text,
  ADD COLUMN IF NOT EXISTS patient_date_of_birth date;

CREATE INDEX IF NOT EXISTS idx_ai_appt_req_cpf
  ON public.ai_appointment_requests(clinic_id, patient_cpf)
  WHERE patient_cpf IS NOT NULL;