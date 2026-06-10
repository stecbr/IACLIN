-- Corrige policy de UPDATE da clínica em operator_credentialings.
-- A policy anterior permitia apenas status='revoked', bloqueando reenvio para pending.

DROP POLICY IF EXISTS "Clinic can revoke own credentialing" ON public.operator_credentialings;
DROP POLICY IF EXISTS "Clinic can manage own credentialing" ON public.operator_credentialings;

CREATE POLICY "Clinic can manage own credentialing"
  ON public.operator_credentialings
  FOR UPDATE
  TO authenticated
  USING (
    public.user_belongs_to_clinic(auth.uid(), clinic_id)
  )
  WITH CHECK (
    public.user_belongs_to_clinic(auth.uid(), clinic_id)
    AND status IN ('pending', 'revoked')
  );
