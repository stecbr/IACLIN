GRANT SELECT ON public.insurance_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.insurance_plans TO authenticated;
GRANT ALL ON public.insurance_plans TO service_role;