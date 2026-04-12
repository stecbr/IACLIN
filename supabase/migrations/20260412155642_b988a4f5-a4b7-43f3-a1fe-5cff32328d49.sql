
-- Storage bucket for bank statements
INSERT INTO storage.buckets (id, name, public) VALUES ('statements', 'statements', false);

CREATE POLICY "Authenticated users can upload statements"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'statements');

CREATE POLICY "Authenticated users can view own statements"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'statements');

-- Imported transactions staging table
CREATE TABLE public.imported_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_file_url TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  transaction_date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'income',
  category TEXT DEFAULT 'imported',
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.imported_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own imported transactions"
ON public.imported_transactions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imported transactions"
ON public.imported_transactions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imported transactions"
ON public.imported_transactions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own imported transactions"
ON public.imported_transactions FOR DELETE TO authenticated
USING (auth.uid() = user_id);
