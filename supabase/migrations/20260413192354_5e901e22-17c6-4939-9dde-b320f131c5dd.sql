
-- Rooms/chairs table
CREATE TABLE public.clinic_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members can view rooms"
ON public.clinic_rooms FOR SELECT TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can insert rooms"
ON public.clinic_rooms FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Clinic members can update rooms"
ON public.clinic_rooms FOR UPDATE TO authenticated
USING (user_belongs_to_clinic(auth.uid(), clinic_id));

CREATE POLICY "Admins can delete rooms"
ON public.clinic_rooms FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_clinic_rooms_updated_at
BEFORE UPDATE ON public.clinic_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add room_id to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.clinic_rooms(id);

-- Add send_confirmation flag to appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS send_confirmation BOOLEAN DEFAULT false;
