CREATE POLICY "Clinic members or owner can delete treatment plans"
ON public.treatment_plans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = treatment_plans.patient_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND treatment_plans.dentist_id = auth.uid())
      )
  )
);

CREATE POLICY "Clinic members or owner can delete plan items"
ON public.treatment_plan_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.treatment_plans tp
    JOIN public.patients p ON p.id = tp.patient_id
    WHERE tp.id = treatment_plan_items.treatment_plan_id
      AND (
        (p.clinic_id IS NOT NULL AND public.user_belongs_to_clinic(auth.uid(), p.clinic_id))
        OR (p.clinic_id IS NULL AND tp.dentist_id = auth.uid())
      )
  )
);