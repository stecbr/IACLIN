-- Anon SELECT policies for marketplace public access

CREATE POLICY "Anon can view profiles" ON public.profiles FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can view clinics" ON public.clinics FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can view clinic members" ON public.clinic_members FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can view appointments" ON public.appointments FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can view insurance plans" ON public.insurance_plans FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can view procedures" ON public.procedures FOR SELECT TO anon USING (true);