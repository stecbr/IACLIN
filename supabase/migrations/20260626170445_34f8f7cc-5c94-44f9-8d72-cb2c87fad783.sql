-- Add approval workflow to treatment_plans
ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS approval_required_by_clinic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);

ALTER TABLE public.treatment_plans
  DROP CONSTRAINT IF EXISTS treatment_plans_status_check;

ALTER TABLE public.treatment_plans
  ADD CONSTRAINT treatment_plans_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'negotiating'::text,
    'approved'::text,
    'lost'::text,
    'awaiting_clinic_approval'::text,
    'rejected_by_clinic'::text
  ]));

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.treatment_plans;

-- Trigger to notify dentist on approve/reject
CREATE OR REPLACE FUNCTION public.notify_treatment_plan_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clinic_id uuid;
  v_patient_name text;
  v_member RECORD;
BEGIN
  SELECT p.clinic_id, p.full_name INTO v_clinic_id, v_patient_name
    FROM public.patients p WHERE p.id = NEW.patient_id;

  -- On insert with awaiting status: notify clinic admins/secretaries
  IF TG_OP = 'INSERT' AND NEW.status = 'awaiting_clinic_approval' THEN
    FOR v_member IN
      SELECT user_id FROM public.clinic_members
      WHERE clinic_id = v_clinic_id AND role IN ('admin', 'secretary')
    LOOP
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        v_clinic_id, v_member.user_id, 'budget_request',
        'Novo orçamento para aprovação',
        'Orçamento "' || NEW.title || '" de ' || COALESCE(v_patient_name, 'paciente') || ' aguarda sua aprovação.',
        NEW.id, 'treatment_plan'
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- On status change: notify dentist
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'pending' AND OLD.status = 'awaiting_clinic_approval' THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        v_clinic_id, NEW.dentist_id, 'budget',
        'Orçamento aprovado pela clínica',
        'O orçamento "' || NEW.title || '" de ' || COALESCE(v_patient_name, 'paciente') || ' foi aprovado e está no pipeline.',
        NEW.id, 'treatment_plan'
      );
    ELSIF NEW.status = 'rejected_by_clinic' THEN
      INSERT INTO public.notifications (clinic_id, user_id, type, title, message, reference_id, reference_type)
      VALUES (
        v_clinic_id, NEW.dentist_id, 'budget',
        'Orçamento recusado pela clínica',
        'O orçamento "' || NEW.title || '" foi recusado.' ||
          CASE WHEN NEW.rejection_reason IS NOT NULL THEN ' Motivo: ' || NEW.rejection_reason ELSE '' END,
        NEW.id, 'treatment_plan'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_treatment_plan_approval ON public.treatment_plans;
CREATE TRIGGER trg_notify_treatment_plan_approval
  AFTER INSERT OR UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.notify_treatment_plan_approval();