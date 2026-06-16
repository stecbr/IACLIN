
CREATE POLICY "Operators can view appointments of their beneficiaries"
ON public.appointments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.operator_members om
    JOIN public.operator_credentialings oc
      ON oc.operator_id = om.operator_id
     AND oc.status = 'approved'
    JOIN public.patients p
      ON p.id = appointments.patient_id
    JOIN public.operator_beneficiaries ob
      ON ob.operator_id = om.operator_id
     AND regexp_replace(coalesce(ob.cpf,''), '\D', '', 'g') = regexp_replace(coalesce(p.cpf,''), '\D', '', 'g')
     AND regexp_replace(coalesce(ob.cpf,''), '\D', '', 'g') <> ''
    WHERE om.user_id = auth.uid()
      AND (oc.clinic_id = appointments.clinic_id OR oc.professional_user_id = appointments.dentist_id)
  )
);
