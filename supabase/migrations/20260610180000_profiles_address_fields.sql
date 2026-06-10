-- Add address fields to profiles table (doctors, dentists, professionals)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood  text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS state         text,
  ADD COLUMN IF NOT EXISTS zip_code      text;
