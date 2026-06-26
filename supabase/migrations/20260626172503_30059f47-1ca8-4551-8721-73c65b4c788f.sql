
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS treatment_plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_financial_transactions_treatment_plan_id ON public.financial_transactions(treatment_plan_id);
