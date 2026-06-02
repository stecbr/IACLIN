-- Pedidos de agendamento criados pela IA Secretária (WhatsApp).
-- Diferente de appointment_requests (que exige paciente logado e dentista),
-- aqui o paciente é anônimo do WhatsApp (nome + telefone) e o dentista é
-- escolhido pela clínica no momento da aprovação.

CREATE TABLE IF NOT EXISTS public.ai_appointment_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Dados do paciente vindos da conversa (pode ainda não existir em patients)
  patient_name    TEXT,
  patient_phone   TEXT        NOT NULL,
  patient_id      UUID        REFERENCES public.patients(id) ON DELETE SET NULL,
  -- Agendamento desejado
  requested_at    TIMESTAMPTZ NOT NULL,         -- data/hora que o paciente quer
  specialty       TEXT,
  procedure       TEXT,
  notes           TEXT,
  -- Fluxo de aprovação
  status          TEXT        NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  appointment_id  UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  decided_at      TIMESTAMPTZ,
  decided_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Rastreio de origem
  source          TEXT        NOT NULL DEFAULT 'ai_whatsapp',
  external_ref    TEXT,                          -- id do agendamento no backend da IA
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_appt_req_clinic_status
  ON public.ai_appointment_requests (clinic_id, status);

ALTER TABLE public.ai_appointment_requests ENABLE ROW LEVEL SECURITY;

-- Membros da clínica podem ver os pedidos
CREATE POLICY "clinic_members_select_ai_appt_req"
  ON public.ai_appointment_requests FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
    )
  );

-- Admin/secretary podem decidir (aprovar/rejeitar = update)
CREATE POLICY "clinic_staff_update_ai_appt_req"
  ON public.ai_appointment_requests FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'secretary')
    )
  );

-- Insert/delete ficam restritos ao service_role (edge function que sincroniza
-- com o backend da IA). Sem policy de insert para usuários comuns = bloqueado por RLS.

-- Trigger para manter updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_ai_appt_req()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_appt_req_updated_at ON public.ai_appointment_requests;
CREATE TRIGGER trg_ai_appt_req_updated_at
  BEFORE UPDATE ON public.ai_appointment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_ai_appt_req();
