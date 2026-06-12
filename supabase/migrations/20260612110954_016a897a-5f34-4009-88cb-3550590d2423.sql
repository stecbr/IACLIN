DELETE FROM public.treatment_plan_items;
DELETE FROM public.clinical_record_procedures;
DELETE FROM public.odontogram_entries;
UPDATE public.appointments SET procedure_id = NULL WHERE procedure_id IS NOT NULL;
DELETE FROM public.clinic_member_procedures;
DELETE FROM public.procedures;