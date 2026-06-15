CREATE POLICY "Operator members can view their insurance transactions"
ON public.financial_transactions
FOR SELECT
TO authenticated
USING (
  operator_id IS NOT NULL
  AND public.user_belongs_to_operator(auth.uid(), operator_id)
);