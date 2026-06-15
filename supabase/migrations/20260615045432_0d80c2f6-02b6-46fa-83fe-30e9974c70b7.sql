DROP POLICY IF EXISTS "optr_price_tables_authenticated_read" ON public.operator_price_tables;
CREATE POLICY "optr_price_tables_authenticated_read" ON public.operator_price_tables
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "optr_price_items_authenticated_read" ON public.operator_price_items;
CREATE POLICY "optr_price_items_authenticated_read" ON public.operator_price_items
  FOR SELECT TO authenticated
  USING (true);