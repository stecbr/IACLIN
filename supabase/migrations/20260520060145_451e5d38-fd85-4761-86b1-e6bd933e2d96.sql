
CREATE TABLE public.ia_gestor_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ia_gestor_threads_user ON public.ia_gestor_threads(user_id, updated_at DESC);

ALTER TABLE public.ia_gestor_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ia threads select"
  ON public.ia_gestor_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users manage own ia threads insert"
  ON public.ia_gestor_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own ia threads update"
  ON public.ia_gestor_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users manage own ia threads delete"
  ON public.ia_gestor_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_ia_gestor_threads_updated
  BEFORE UPDATE ON public.ia_gestor_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ia_gestor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ia_gestor_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  sdk_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ia_gestor_messages_thread ON public.ia_gestor_messages(thread_id, created_at);

ALTER TABLE public.ia_gestor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own ia messages select"
  ON public.ia_gestor_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ia_gestor_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "Users access own ia messages insert"
  ON public.ia_gestor_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ia_gestor_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "Users access own ia messages delete"
  ON public.ia_gestor_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ia_gestor_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
