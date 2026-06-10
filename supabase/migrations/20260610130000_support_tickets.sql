-- Support Ticket System
-- Doctors/dentists communicate with insurance operators
-- Solo doctors: direct to operator. Clinic doctors: via clinic owner.

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('pending_owner', 'open', 'answered', 'closed')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  operator_id uuid REFERENCES public.insurance_operators(id) ON DELETE SET NULL,
  forwarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  forwarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_ticket_messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.support_tickets(created_by);
CREATE INDEX ON public.support_tickets(clinic_id);
CREATE INDEX ON public.support_tickets(operator_id);
CREATE INDEX ON public.support_tickets(status);
CREATE INDEX ON public.support_ticket_messages(ticket_id);
CREATE INDEX ON public.support_ticket_attachments(message_id);

-- Auto-bump updated_at on new messages
CREATE OR REPLACE FUNCTION public.update_support_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ticket_msg_bump
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_support_ticket_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: can current user see a given ticket?
-- (creator, clinic owner, or operator member)
CREATE OR REPLACE FUNCTION public.can_access_ticket(ticket_row public.support_tickets)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ticket_row.created_by = auth.uid()
    OR (
      ticket_row.clinic_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.clinic_members cm
        WHERE cm.clinic_id = ticket_row.clinic_id
          AND cm.user_id = auth.uid()
          AND cm.is_owner = true
      )
    )
    OR (
      ticket_row.operator_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.operator_members om
        WHERE om.operator_id = ticket_row.operator_id
          AND om.user_id = auth.uid()
      )
    )
$$;

-- Tickets: select
CREATE POLICY "tickets_select" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.can_access_ticket(support_tickets.*));

-- Tickets: insert (creator only)
CREATE POLICY "tickets_insert" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Tickets: update (creator, clinic owner, or operator)
CREATE POLICY "tickets_update" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.can_access_ticket(support_tickets.*));

-- Messages: select
CREATE POLICY "ticket_messages_select" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND public.can_access_ticket(t.*)
    )
  );

-- Messages: insert (must be sender, ticket must not be closed)
CREATE POLICY "ticket_messages_insert" ON public.support_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND t.status != 'closed'
        AND public.can_access_ticket(t.*)
    )
  );

-- Attachments: select
CREATE POLICY "ticket_attachments_select" ON public.support_ticket_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_ticket_messages m
      JOIN public.support_tickets t ON t.id = m.ticket_id
      WHERE m.id = support_ticket_attachments.message_id
        AND public.can_access_ticket(t.*)
    )
  );

-- Attachments: insert (message sender only)
CREATE POLICY "ticket_attachments_insert" ON public.support_ticket_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_ticket_messages m
      WHERE m.id = support_ticket_attachments.message_id
        AND m.sender_id = auth.uid()
    )
  );
