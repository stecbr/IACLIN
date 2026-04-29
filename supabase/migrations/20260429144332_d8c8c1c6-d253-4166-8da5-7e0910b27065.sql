-- Backfill clinic_members.specialty and registration_number from auth.users metadata
-- captured at signup. Only fills in NULLs; never overwrites existing values.
UPDATE public.clinic_members cm
SET
  specialty = COALESCE(
    cm.specialty,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'specialty', '')), '')
  ),
  registration_number = COALESCE(
    cm.registration_number,
    NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'registration_number', '')), '')
  )
FROM auth.users u
WHERE u.id = cm.user_id
  AND (
    (cm.specialty IS NULL AND NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'specialty', '')), '') IS NOT NULL)
    OR
    (cm.registration_number IS NULL AND NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'registration_number', '')), '') IS NOT NULL)
  );