DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'insurance_plans'
      AND policyname = 'Authenticated booking can view active insurance plans'
  ) THEN
    CREATE POLICY "Authenticated booking can view active insurance plans"
    ON public.insurance_plans
    FOR SELECT
    TO authenticated
    USING (is_active = true);
  END IF;
END $$;

GRANT SELECT ON public.insurance_plans TO authenticated;
GRANT SELECT ON public.insurance_plans TO anon;
GRANT ALL ON public.insurance_plans TO service_role;