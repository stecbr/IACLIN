-- Operator price / procedure tables

create table if not exists public.operator_price_tables (
  id          uuid        primary key default gen_random_uuid(),
  operator_id uuid        not null references public.insurance_operators(id) on delete cascade,
  name        text        not null,
  region      text,
  state       text,
  city        text,
  valid_from  date        not null default current_date,
  valid_until date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_opt_operator on public.operator_price_tables(operator_id);

alter table public.operator_price_tables enable row level security;

-- operator members can manage
create policy "optr_price_tables_member_all"
  on public.operator_price_tables for all
  using (public.user_belongs_to_operator(auth.uid(), operator_id));

-- credentialed clinics can read
create policy "optr_price_tables_clinic_read"
  on public.operator_price_tables for select
  using (
    operator_id in (
      select oc.operator_id
      from public.operator_credentialings oc
      join public.clinic_members cm on cm.clinic_id = oc.clinic_id
      where cm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------

create table if not exists public.operator_price_items (
  id             uuid        primary key default gen_random_uuid(),
  table_id       uuid        not null references public.operator_price_tables(id) on delete cascade,
  category       text        not null default 'Geral',
  procedure_name text        not null,
  tuss_code      text,
  charge_type    text        not null default 'Geral',
  value_us       numeric(10,2),
  value_brl      numeric(10,2),
  rx_required    boolean     not null default false,
  longevity      text,
  observations   text,
  photo_required boolean     not null default false,
  plan_coverage  text[]      not null default '{}',
  sort_order     int         not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_opi_table on public.operator_price_items(table_id);

alter table public.operator_price_items enable row level security;

create policy "optr_price_items_member_all"
  on public.operator_price_items for all
  using (
    table_id in (
      select id from public.operator_price_tables
      where public.user_belongs_to_operator(auth.uid(), operator_id)
    )
  );

create policy "optr_price_items_clinic_read"
  on public.operator_price_items for select
  using (
    table_id in (
      select t.id from public.operator_price_tables t
      join public.operator_credentialings oc on oc.operator_id = t.operator_id
      join public.clinic_members cm on cm.clinic_id = oc.clinic_id
      where cm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------

create table if not exists public.operator_price_files (
  id         uuid        primary key default gen_random_uuid(),
  table_id   uuid        not null references public.operator_price_tables(id) on delete cascade,
  file_name  text        not null,
  file_url   text        not null,
  file_type  text,
  file_size  int,
  created_at timestamptz not null default now()
);

create index if not exists idx_opf_table on public.operator_price_files(table_id);

alter table public.operator_price_files enable row level security;

create policy "optr_price_files_member_all"
  on public.operator_price_files for all
  using (
    table_id in (
      select id from public.operator_price_tables
      where public.user_belongs_to_operator(auth.uid(), operator_id)
    )
  );

create policy "optr_price_files_clinic_read"
  on public.operator_price_files for select
  using (
    table_id in (
      select t.id from public.operator_price_tables t
      join public.operator_credentialings oc on oc.operator_id = t.operator_id
      join public.clinic_members cm on cm.clinic_id = oc.clinic_id
      where cm.user_id = auth.uid()
    )
  );
