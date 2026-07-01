-- Add ticket_type column to distinguish operator vs clinic tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_type TEXT NOT NULL DEFAULT 'to_operator';

-- Backfill existing rows
UPDATE public.support_tickets SET ticket_type = 'to_operator' WHERE ticket_type IS NULL;
