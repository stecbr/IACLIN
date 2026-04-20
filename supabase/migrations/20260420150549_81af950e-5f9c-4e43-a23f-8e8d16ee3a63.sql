-- Tabela de mensagens do WhatsApp recebidas/enviadas pela Secretária IA
CREATE TABLE public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_phone text NOT NULL,
  patient_name text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text',
  handled_by text NOT NULL DEFAULT 'ai' CHECK (handled_by IN ('ai', 'human', 'system')),
  status text NOT NULL DEFAULT 'received',
  external_message_id text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_clinic_created ON public.whatsapp_messages (clinic_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_clinic_phone ON public.whatsapp_messages (clinic_id, patient_phone);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view messages"
ON public.whatsapp_messages FOR SELECT TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert messages"
ON public.whatsapp_messages FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete messages"
ON public.whatsapp_messages FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Habilita Realtime
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;