
-- Tabela de feriados por clínica
CREATE TABLE IF NOT EXISTS public.clinic_holidays (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, date)
);

ALTER TABLE public.clinic_holidays ENABLE ROW LEVEL SECURITY;

-- Qualquer membro da clínica pode ler os feriados
CREATE POLICY "clinic_members_select_holidays"
  ON public.clinic_holidays FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members WHERE user_id = auth.uid()
    )
  );

-- Apenas admin/owner pode criar, editar ou excluir
CREATE POLICY "clinic_admins_insert_holidays"
  ON public.clinic_holidays FOR INSERT
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "clinic_admins_update_holidays"
  ON public.clinic_holidays FOR UPDATE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "clinic_admins_delete_holidays"
  ON public.clinic_holidays FOR DELETE
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.clinic_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
