-- Folders for IA Gestor conversations
CREATE TABLE public.ia_gestor_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid,
  name text NOT NULL DEFAULT 'Nova pasta',
  color text NOT NULL DEFAULT 'rose',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ia_gestor_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folders"
  ON public.ia_gestor_folders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
  ON public.ia_gestor_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.ia_gestor_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.ia_gestor_folders FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_ia_gestor_folders_updated_at
  BEFORE UPDATE ON public.ia_gestor_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Link threads to folders
ALTER TABLE public.ia_gestor_threads
  ADD COLUMN folder_id uuid REFERENCES public.ia_gestor_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_ia_gestor_threads_folder ON public.ia_gestor_threads(folder_id);
CREATE INDEX idx_ia_gestor_folders_user ON public.ia_gestor_folders(user_id);