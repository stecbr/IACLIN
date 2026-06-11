-- 1. Profiles address fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS address            text,
  ADD COLUMN IF NOT EXISTS address_number     text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood       text,
  ADD COLUMN IF NOT EXISTS city               text,
  ADD COLUMN IF NOT EXISTS state              text,
  ADD COLUMN IF NOT EXISTS zip_code           text;

-- 2. Marketplace RPC with phone + address (drop first to change return type)
DROP FUNCTION IF EXISTS public.get_marketplace_doctor_profiles(uuid[]);
CREATE FUNCTION public.get_marketplace_doctor_profiles(_user_ids uuid[])
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, phone text,
  address text, address_number text, neighborhood text,
  city text, state text, zip_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.phone,
         p.address, p.address_number, p.neighborhood,
         p.city, p.state, p.zip_code
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = p.id AND cm.role IN ('dentist','admin')
    );
$$;
GRANT EXECUTE ON FUNCTION public.get_marketplace_doctor_profiles(uuid[]) TO anon, authenticated;

-- 3. Operator price tables
CREATE TABLE IF NOT EXISTS public.operator_price_tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.insurance_operators(id) ON DELETE CASCADE,
  name        text NOT NULL,
  region      text,
  state       text,
  city        text,
  valid_from  date NOT NULL DEFAULT current_date,
  valid_until date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opt_operator ON public.operator_price_tables(operator_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_price_tables TO authenticated;
GRANT ALL ON public.operator_price_tables TO service_role;
ALTER TABLE public.operator_price_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "optr_price_tables_member_all" ON public.operator_price_tables;
CREATE POLICY "optr_price_tables_member_all" ON public.operator_price_tables
  FOR ALL USING (public.user_belongs_to_operator(auth.uid(), operator_id))
  WITH CHECK (public.user_belongs_to_operator(auth.uid(), operator_id));
DROP POLICY IF EXISTS "optr_price_tables_clinic_read" ON public.operator_price_tables;
CREATE POLICY "optr_price_tables_clinic_read" ON public.operator_price_tables
  FOR SELECT USING (
    operator_id IN (
      SELECT oc.operator_id FROM public.operator_credentialings oc
      JOIN public.clinic_members cm ON cm.clinic_id = oc.clinic_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.operator_price_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       uuid NOT NULL REFERENCES public.operator_price_tables(id) ON DELETE CASCADE,
  category       text NOT NULL DEFAULT 'Geral',
  procedure_name text NOT NULL,
  tuss_code      text,
  charge_type    text NOT NULL DEFAULT 'Geral',
  value_us       numeric(10,2),
  value_brl      numeric(10,2),
  rx_required    boolean NOT NULL DEFAULT false,
  longevity      text,
  observations   text,
  photo_required boolean NOT NULL DEFAULT false,
  plan_coverage  text[] NOT NULL DEFAULT '{}',
  sort_order     int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opi_table ON public.operator_price_items(table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_price_items TO authenticated;
GRANT ALL ON public.operator_price_items TO service_role;
ALTER TABLE public.operator_price_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "optr_price_items_member_all" ON public.operator_price_items;
CREATE POLICY "optr_price_items_member_all" ON public.operator_price_items
  FOR ALL USING (
    table_id IN (SELECT id FROM public.operator_price_tables
                 WHERE public.user_belongs_to_operator(auth.uid(), operator_id))
  )
  WITH CHECK (
    table_id IN (SELECT id FROM public.operator_price_tables
                 WHERE public.user_belongs_to_operator(auth.uid(), operator_id))
  );
DROP POLICY IF EXISTS "optr_price_items_clinic_read" ON public.operator_price_items;
CREATE POLICY "optr_price_items_clinic_read" ON public.operator_price_items
  FOR SELECT USING (
    table_id IN (
      SELECT t.id FROM public.operator_price_tables t
      JOIN public.operator_credentialings oc ON oc.operator_id = t.operator_id
      JOIN public.clinic_members cm ON cm.clinic_id = oc.clinic_id
      WHERE cm.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.operator_price_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id   uuid NOT NULL REFERENCES public.operator_price_tables(id) ON DELETE CASCADE,
  file_name  text NOT NULL,
  file_url   text NOT NULL,
  file_type  text,
  file_size  int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opf_table ON public.operator_price_files(table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_price_files TO authenticated;
GRANT ALL ON public.operator_price_files TO service_role;
ALTER TABLE public.operator_price_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "optr_price_files_member_all" ON public.operator_price_files;
CREATE POLICY "optr_price_files_member_all" ON public.operator_price_files
  FOR ALL USING (
    table_id IN (SELECT id FROM public.operator_price_tables
                 WHERE public.user_belongs_to_operator(auth.uid(), operator_id))
  )
  WITH CHECK (
    table_id IN (SELECT id FROM public.operator_price_tables
                 WHERE public.user_belongs_to_operator(auth.uid(), operator_id))
  );
DROP POLICY IF EXISTS "optr_price_files_clinic_read" ON public.operator_price_files;
CREATE POLICY "optr_price_files_clinic_read" ON public.operator_price_files
  FOR SELECT USING (
    table_id IN (
      SELECT t.id FROM public.operator_price_tables t
      JOIN public.operator_credentialings oc ON oc.operator_id = t.operator_id
      JOIN public.clinic_members cm ON cm.clinic_id = oc.clinic_id
      WHERE cm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';