-- ---------------------------------------------------------------------------
-- Her rol sistem yoneticisi onayindan gecsin
--
-- Onceki davranis: ogrenci secen kullanici dogrudan iceri giriyordu, yalnizca
-- diger uc rol onaya dusuyordu. Artik DORT ROL de onay bekler - sisteme kimin
-- girdigi tumuyle sistem yoneticisinin kontrolunde.
--
-- Onkosul: 2026-08-22-coklu-rol.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Yeni kayit: hangi rol secilirse secilsin onaya duser ------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested public.user_role;
  status    public.role_status;
begin
  begin
    requested := (new.raw_user_meta_data ->> 'role')::public.user_role;
  exception when others then
    requested := null;
  end;

  -- Rol secilmemisse (or. Google ile ilk giris) once /hosgeldiniz ekraninda
  -- secilir; secilmisse dogrudan onay kuyruguna girer.
  status := case when requested is null then 'secilmedi' else 'beklemede' end;

  insert into public.users (id, role, roles, role_status, requested_role, full_name, email)
  values (
    new.id,
    'ogrenci',
    array['ogrenci']::public.user_role[],
    status,
    requested,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 2. Rol talebi: ogrenci de artik dogrudan onaylanmiyor --------------------
create or replace function public.request_role(target public.user_role)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = 'ogrenci',
      requested_role   = target,
      role_status      = 'beklemede',
      role_reviewed_by = null,
      role_reviewed_at = null,
      updated_at       = now()
  where id = auth.uid();

  perform set_config('app.role_change_allowed', 'off', true);

  return 'beklemede';
end;
$$;

-- 3. Kontrol ---------------------------------------------------------------
-- select email, role, roles, role_status, requested_role from public.users;
