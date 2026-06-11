CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  clinic_id uuid,
  operator_id uuid,
  forwarded_by uuid,
  forwarded_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view tickets" ON public.support_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ticket messages" ON public.support_ticket_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ticket messages" ON public.support_ticket_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_attachments TO authenticated;
GRANT ALL ON public.support_ticket_attachments TO service_role;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ticket attachments" ON public.support_ticket_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ticket attachments" ON public.support_ticket_attachments FOR INSERT TO authenticated WITH CHECK (true);