-- A policy anterior só liberava o agendamento para a operadora se o CPF do
-- paciente batesse com um registro em operator_beneficiaries. Na prática a
-- clínica não exige que o paciente tenha "carteirinha" cadastrada com a
-- operadora para agendar por convênio, então essa exigência escondia
-- agendamentos legítimos. A visibilidade agora depende só do credenciamento
-- clínica↔operadora (operator_credentialings aprovado), igual ao resto do
-- painel da operadora (Rede credenciada, Agenda).
DROP POLICY IF EXISTS "Operators can view appointments of their beneficiaries" ON public.appointments;

CREATE POLICY "Operators can view appointments of credentialed clinics"
ON public.appointments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.operator_members om
    JOIN public.operator_credentialings oc
      ON oc.operator_id = om.operator_id
     AND oc.status = 'approved'
     AND oc.clinic_id = appointments.clinic_id
    WHERE om.user_id = auth.uid()
  )
);
