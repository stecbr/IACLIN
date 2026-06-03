-- Allow patients and other authenticated users to view minimal clinic_members data
-- needed to discover professionals for booking (marketplace + patient booking flow).
-- Restricted to dentist/admin roles (the bookable ones); does not expose secretaries.
CREATE POLICY "Public booking can view bookable clinic members"
ON public.clinic_members
FOR SELECT
TO authenticated, anon
USING (role IN ('dentist'::app_role, 'admin'::app_role));

GRANT SELECT ON public.clinic_members TO anon;