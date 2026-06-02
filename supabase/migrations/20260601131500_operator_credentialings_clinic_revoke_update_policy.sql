-- Permite cancelamento de credenciamento pela clínica via UPDATE para status=revoked.
-- Necessário porque o fluxo atual não remove registro (DELETE), apenas revoga.

DROP POLICY IF EXISTS "Clinic can revoke own credentialing" ON public.operator_credentialings;

CREATE POLICY "Clinic can revoke own credentialing"
  ON public.operator_credentialings
  FOR UPDATE
  TO authenticated
  USING (
    public.user_belongs_to_clinic(auth.uid(), clinic_id)
  )
  WITH CHECK (
    public.user_belongs_to_clinic(auth.uid(), clinic_id)
    AND status = 'revoked'
  );
