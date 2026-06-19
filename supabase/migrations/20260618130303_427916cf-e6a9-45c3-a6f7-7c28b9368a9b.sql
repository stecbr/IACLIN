
ALTER TABLE public.platform_plans
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id text;

ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_email text,
  ADD COLUMN IF NOT EXISTS mp_init_point text;

CREATE INDEX IF NOT EXISTS idx_platform_subscriptions_mp_preapproval
  ON public.platform_subscriptions(mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;
