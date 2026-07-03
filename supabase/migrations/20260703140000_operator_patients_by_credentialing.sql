-- A operadora já consegue ver os agendamentos das clínicas credenciadas
-- (20260703130000), mas a policy de patients não libera leitura pra ela —
-- o join appointments→patients volta null e a agenda mostra "Paciente" no
-- lugar do nome real. Libera leitura de patients para a operadora, restrita
-- aos pacientes de clínicas credenciadas (aprovadas) a ela.
CREATE POLICY "Operators can view patients of credentialed clinics"
ON public.patients
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.operator_members om
    JOIN public.operator_credentialings oc
      ON oc.operator_id = om.operator_id
     AND oc.status = 'approved'
     AND oc.clinic_id = patients.clinic_id
    WHERE om.user_id = auth.uid()
  )
);
