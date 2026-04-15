
-- Allow authenticated users to view all clinic members (for marketplace)
CREATE POLICY "Authenticated can view all clinic members"
ON public.clinic_members FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to view all appointments (for marketplace slot calculation)
CREATE POLICY "Authenticated can view all appointments"
ON public.appointments FOR SELECT TO authenticated USING (true);
