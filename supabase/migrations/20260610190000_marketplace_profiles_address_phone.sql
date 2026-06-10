-- Extend get_marketplace_doctor_profiles to also return phone and address fields
create or replace function public.get_marketplace_doctor_profiles(_user_ids uuid[])
returns table(
  id               uuid,
  full_name        text,
  avatar_url       text,
  phone            text,
  address          text,
  address_number   text,
  neighborhood     text,
  city             text,
  state            text,
  zip_code         text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.phone,
    p.address,
    p.address_number,
    p.neighborhood,
    p.city,
    p.state,
    p.zip_code
  from public.profiles p
  where p.id = any(_user_ids)
    and exists (
      select 1 from public.clinic_members cm
      where cm.user_id = p.id and cm.role in ('dentist','admin')
    );
$$;

grant execute on function public.get_marketplace_doctor_profiles(uuid[]) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
