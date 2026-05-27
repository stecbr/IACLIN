-- =============================================
-- ÁREA DO SUPER ADMINISTRADOR DA PLATAFORMA
-- =============================================

-- 1. Tabela de admins da plataforma
create table if not exists public.platform_admins (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null unique,
  user_id    uuid,       -- preenchido automaticamente no primeiro login
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Pré-cadastra o e-mail do super admin
insert into public.platform_admins (email)
values ('iaclin@gmail.com')
on conflict (email) do nothing;

-- 2. Função helper: verifica se o usuário atual é admin da plataforma
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where lower(pa.email) = lower(
      (select email from auth.users where id = auth.uid())
    )
  )
$$;

-- 3. RLS: somente o próprio admin pode ler a tabela
create policy "platform_admins_select"
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

-- =============================================
-- 4. Tabela de assinaturas/pagamentos por entidade
-- =============================================
create table if not exists public.platform_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  entity_type  text        not null check (entity_type in ('clinic', 'doctor')),
  entity_id    uuid        not null,
  plan_name    text        not null default 'Básico',
  status       text        not null default 'trial'
                           check (status in ('active', 'trial', 'overdue', 'cancelled')),
  amount_cents integer     not null default 0,
  due_date     date,
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (entity_type, entity_id)
);

alter table public.platform_subscriptions enable row level security;

create policy "platform_subscriptions_admin_all"
  on public.platform_subscriptions for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- =============================================
-- 5. RPC: estatísticas agregadas (zero PII)
-- =============================================
create or replace function public.get_platform_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'access_denied: not a platform admin';
  end if;

  select json_build_object(
    'total_clinics',  (select count(*)::int  from public.clinics),
    'total_doctors',  (select count(distinct user_id)::int
                       from public.clinic_members
                       where role in ('admin', 'dentist')),
    'total_patients', (select count(*)::int
                       from public.user_roles
                       where role = 'patient'),
    'active_subs',    (select count(*)::int
                       from public.platform_subscriptions
                       where status = 'active'),
    'trial_subs',     (select count(*)::int
                       from public.platform_subscriptions
                       where status = 'trial'),
    'overdue_subs',   (select count(*)::int
                       from public.platform_subscriptions
                       where status = 'overdue')
  ) into v_result;

  return v_result;
end;
$$;

-- =============================================
-- 6. RPC: lista de clínicas para o admin (sem dados de pacientes)
-- =============================================
create or replace function public.get_platform_clinics_list()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'access_denied';
  end if;

  select coalesce(json_agg(row_data order by created_at desc), '[]'::json)
  into v_result
  from (
    select json_build_object(
      'id',           c.id,
      'name',         c.name,
      'category',     c.category,
      'city',         c.city,
      'state',        c.state,
      'email',        c.email,
      'phone',        c.phone,
      'created_at',   c.created_at,
      'member_count', (
        select count(*)::int
        from public.clinic_members cm
        where cm.clinic_id = c.id
      ),
      'subscription', (
        select row_to_json(ps)
        from public.platform_subscriptions ps
        where ps.entity_type = 'clinic'
          and ps.entity_id   = c.id
        limit 1
      )
    ) as row_data,
    c.created_at
    from public.clinics c
  ) sub;

  return v_result;
end;
$$;

-- =============================================
-- 7. RPC: lista de médicos/profissionais para o admin (sem dados de pacientes)
-- =============================================
create or replace function public.get_platform_doctors_list()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_platform_admin() then
    raise exception 'access_denied';
  end if;

  select coalesce(json_agg(row_data order by joined_at desc), '[]'::json)
  into v_result
  from (
    select json_build_object(
      'user_id',      p.id,
      'full_name',    p.full_name,
      'specialty',    cm.specialty,
      'registration', cm.registration_number,
      'role',         cm.role,
      'is_owner',     cm.is_owner,
      'clinic_id',    cm.clinic_id,
      'clinic_name',  cl.name,
      'created_at',   cm.created_at,
      'subscription', (
        select row_to_json(ps)
        from public.platform_subscriptions ps
        where ps.entity_type = 'doctor'
          and ps.entity_id   = p.id
        limit 1
      )
    ) as row_data,
    cm.created_at as joined_at
    from public.clinic_members cm
    join  public.profiles p  on p.id  = cm.user_id
    left join public.clinics cl on cl.id = cm.clinic_id
    where cm.role in ('admin', 'dentist')
  ) sub;

  return v_result;
end;
$$;

-- =============================================
-- 8. RPC: criar / atualizar assinatura de uma entidade
-- =============================================
create or replace function public.upsert_platform_subscription(
  p_entity_type  text,
  p_entity_id    uuid,
  p_plan_name    text,
  p_status       text,
  p_amount_cents integer,
  p_due_date     date,
  p_notes        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'access_denied';
  end if;

  insert into public.platform_subscriptions
    (entity_type, entity_id, plan_name, status, amount_cents, due_date, notes, updated_at)
  values
    (p_entity_type, p_entity_id, p_plan_name, p_status, p_amount_cents, p_due_date, p_notes, now())
  on conflict (entity_type, entity_id) do update
    set plan_name    = excluded.plan_name,
        status       = excluded.status,
        amount_cents = excluded.amount_cents,
        due_date     = excluded.due_date,
        notes        = excluded.notes,
        updated_at   = now()
  returning id into v_id;

  return v_id;
end;
$$;
