-- Chaves de API para operadoras integrarem sistemas externos com a IACLIN
-- (leitura de beneficiários, rede credenciada e tabela de valores).
-- A chave em texto puro nunca é persistida: só o hash SHA-256 é armazenado,
-- calculado no cliente (geração) e na edge function operator-api (validação).

create table if not exists public.operator_api_keys (
  id           uuid        primary key default gen_random_uuid(),
  operator_id  uuid        not null references public.insurance_operators(id) on delete cascade,
  name         text        not null,
  key_prefix   text        not null,
  key_hash     text        not null unique,
  created_by   uuid        references auth.users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_operator_api_keys_operator on public.operator_api_keys(operator_id);
create index if not exists idx_operator_api_keys_active_hash on public.operator_api_keys(key_hash) where revoked_at is null;

alter table public.operator_api_keys enable row level security;

create policy "optr_api_keys_member_all"
  on public.operator_api_keys for all
  using (public.user_belongs_to_operator(auth.uid(), operator_id))
  with check (public.user_belongs_to_operator(auth.uid(), operator_id));
