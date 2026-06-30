
DROP INDEX IF EXISTS public.insurance_operators_ans_code_uniq;
ALTER TABLE public.insurance_operators
  ADD CONSTRAINT insurance_operators_ans_code_key UNIQUE (ans_code);
