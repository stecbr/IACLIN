-- Clinic-level credentialing model:
-- enforce one credentialing row per (operator_id, clinic_id).

-- 1) Keep only the latest row per operator + clinic.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY operator_id, clinic_id
      ORDER BY requested_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.operator_credentialings
)
DELETE FROM public.operator_credentialings oc
USING ranked r
WHERE oc.id = r.id
  AND r.rn > 1;

-- 2) Remove previous member-based uniqueness if present.
ALTER TABLE public.operator_credentialings
  DROP CONSTRAINT IF EXISTS operator_credentialings_operator_id_clinic_member_id_key;

DROP INDEX IF EXISTS uq_operator_credentialings_operator_member;

-- 3) Enforce clinic-level uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_credentialings_operator_clinic
  ON public.operator_credentialings (operator_id, clinic_id);

-- 4) Query helper indexes.
CREATE INDEX IF NOT EXISTS idx_operator_credentialings_operator_clinic_status
  ON public.operator_credentialings (operator_id, clinic_id, status);
