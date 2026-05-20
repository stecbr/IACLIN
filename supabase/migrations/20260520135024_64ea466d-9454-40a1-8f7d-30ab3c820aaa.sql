create table public.patient_personalizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  color text,
  tag text,
  is_favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, patient_id)
);

alter table public.patient_personalizations enable row level security;

create policy "own select" on public.patient_personalizations
  for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.patient_personalizations
  for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.patient_personalizations
  for update to authenticated using (user_id = auth.uid());
create policy "own delete" on public.patient_personalizations
  for delete to authenticated using (user_id = auth.uid());

create index patient_personalizations_user_patient_idx
  on public.patient_personalizations (user_id, patient_id);
create index patient_personalizations_favorites_idx
  on public.patient_personalizations (user_id) where is_favorite;

create trigger trg_patient_personalizations_updated_at
  before update on public.patient_personalizations
  for each row execute function public.update_updated_at_column();