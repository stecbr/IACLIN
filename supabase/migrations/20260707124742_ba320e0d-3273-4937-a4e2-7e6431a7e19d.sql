
-- Campanhas de comunicação (WhatsApp/SMS) — histórico persistido no Supabase.
-- O disparo é feito pelo backend IA externo; aqui guardamos a campanha e a lista de destinatários.

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  template TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMPTZ,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view campaigns" ON public.campaigns
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can update campaigns" ON public.campaigns
  FOR UPDATE USING (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can delete campaigns" ON public.campaigns
  FOR DELETE USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_campaigns_clinic_created ON public.campaigns(clinic_id, created_at DESC);

CREATE TABLE public.campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_status TEXT,
  sms_status TEXT,
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_recipients TO authenticated;
GRANT ALL ON public.campaign_recipients TO service_role;

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view recipients" ON public.campaign_recipients
  FOR SELECT USING (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can insert recipients" ON public.campaign_recipients
  FOR INSERT WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can update recipients" ON public.campaign_recipients
  FOR UPDATE USING (user_belongs_to_clinic(auth.uid(), clinic_id));
CREATE POLICY "Clinic members can delete recipients" ON public.campaign_recipients
  FOR DELETE USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
