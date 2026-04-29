-- Clear bogus registration_number values that match the clinic invite code pattern
UPDATE public.clinic_members
SET registration_number = NULL
WHERE registration_number ~ '^CLIN-[A-Z2-9]{8}$';