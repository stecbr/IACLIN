-- Ensure operator credentialings keep only latest row per operator/member and enforce uniqueness.

-- 1) Delete duplicated historical rows, keeping the most recent per (operator_id, clinic_member_id).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY operator_id, clinic_member_id
      ORDER BY requested_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.operator_credentialings
)
DELETE FROM public.operator_credentialings oc
USING ranked r
WHERE oc.id = r.id
  AND r.rn > 1;

-- 2) Add/ensure unique index to avoid new duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_operator_credentialings_operator_member
  ON public.operator_credentialings (operator_id, clinic_member_id);

-- 3) Helpful index for latest-first dashboards.
CREATE INDEX IF NOT EXISTS idx_operator_credentialings_operator_requested
  ON public.operator_credentialings (operator_id, requested_at DESC);
