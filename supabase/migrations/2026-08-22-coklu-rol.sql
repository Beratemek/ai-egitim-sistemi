-- ---------------------------------------------------------------------------
-- Bir kullaniciya BIRDEN FAZLA rol
--
-- Tasarim: iki alan birlikte calisir.
--   users.roles  -> kullaniciya VERILMIS roller (kume). Yetkiyi bu belirler.
--   users.role   -> su an AKTIF olan rol. Yalnizca hangi panele dusulecegini
--                   ve basliklarda ne yazacagini belirler.
--
-- Boylece 98 yerde gecen `has_role()` cagrisi degismeden dogru calisir:
-- fonksiyonun ICI kumeye bakacak sekilde guncellenir, politikalara
-- dokunulmaz. Aktif rol yalnizca yonlendirme icindir, YETKI KAYNAGI DEGILDIR.
--
-- Onkosul: 2026-08-22-admin-rolu-* migration'lari.
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Roller kumesi -----------------------------------------------------------
alter table public.users
  add column if not exists roles public.user_role[] not null default '{}'::public.user_role[];

comment on column public.users.roles is
  'Kullaniciya verilmis roller. Yetki bu kumeye gore belirlenir (bkz. has_role).';
comment on column public.users.role is
  'Su an aktif olan rol. Yalnizca yonlendirme ve basliklar icindir; yetki kaynagi degildir.';

-- Mevcut kayitlar: tek rolu kumeye tasi.
update public.users
set roles = array[role]::public.user_role[]
where roles = '{}'::public.user_role[];

create index if not exists users_roles_idx on public.users using gin (roles);

-- 2. has_role artik KUMEYE bakar ---------------------------------------------
-- Kume bos kalmis eski bir kayit olursa aktif role duser; sistem kilitlenmesin.
create or replace function public.has_role(target public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and (
        target = any(roles)
        or (cardinality(roles) = 0 and role = target)
      )
  );
$$;

-- 3. is_admin de kumeye bakar ------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and (
        'admin' = any(roles::text[])
        or (cardinality(roles) = 0 and role::text = 'admin')
      )
  );
$$;

-- 4. Sistem yoneticisi: kullaniciya rol KUMESI atar --------------------------
create or replace function public.set_user_roles(
  target_user uuid,
  new_roles public.user_role[]
)
returns public.user_role[]
language plpgsql
security definer
set search_path = public
as $$
declare
  temiz public.user_role[];
  aktif public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Rol atamasi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  if target_user = auth.uid() then
    raise exception 'Kendi rollerinizi degistiremezsiniz; sistemde yonetici kalmayabilir.'
      using errcode = '42501';
  end if;

  -- Tekrarlari at, bos kume birak.
  select coalesce(array_agg(distinct r), '{}'::public.user_role[])
  into temiz
  from unnest(coalesce(new_roles, '{}'::public.user_role[])) as r;

  if cardinality(temiz) = 0 then
    raise exception 'En az bir rol secilmelidir.' using errcode = '22023';
  end if;

  select role into aktif from public.users where id = target_user;

  if aktif is null then
    raise exception 'Kullanici bulunamadi.' using errcode = '22023';
  end if;

  -- Aktif rol artik verilmemisse ilk role dus.
  if not (aktif = any(temiz)) then
    aktif := temiz[1];
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set roles            = temiz,
      role             = aktif,
      role_status      = 'onayli',
      requested_role   = null,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return temiz;
end;
$$;

grant execute on function public.set_user_roles(uuid, public.user_role[]) to authenticated;

-- 5. Kullanici kendi AKTIF rolunu secer --------------------------------------
-- Yalnizca kendisine VERILMIS roller arasindan; yetki genisletmez.
create or replace function public.set_active_role(target public.user_role)
returns public.user_role
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users
    where id = auth.uid() and target = any(roles)
  ) then
    raise exception 'Bu rol size verilmemis.' using errcode = '42501';
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role = target, updated_at = now()
  where id = auth.uid();

  perform set_config('app.role_change_allowed', 'off', true);

  return target;
end;
$$;

grant execute on function public.set_active_role(public.user_role) to authenticated;

-- 6. Koruma tetikleyicisi `roles` alanini da kapsasin ------------------------
create or replace function public.guard_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.roles is distinct from old.roles
      or new.role_status is distinct from old.role_status
      or new.requested_role is distinct from old.requested_role)
     and coalesce(current_setting('app.role_change_allowed', true), 'off') <> 'on'
  then
    raise exception 'Rol alanlari dogrudan degistirilemez; ilgili fonksiyonlari kullanin.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 7. Rol talebi onaylanınca rol KUMEYE eklenir (uzerine yazmaz) -------------
create or replace function public.review_role_request(
  target_user uuid,
  approve boolean
)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not public.is_admin() then
    raise exception 'Rol talepleri yalnizca sistem yoneticisi tarafindan karara baglanir.'
      using errcode = '42501';
  end if;

  select requested_role into wanted from public.users where id = target_user;

  if wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.'
      using errcode = '22023';
  end if;

  result := case when approve then 'onayli' else 'reddedildi' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set roles = case
        when approve and not (wanted = any(roles)) then roles || wanted
        else roles
      end,
      role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 8. Yeni kayitta kume da dolsun ---------------------------------------------
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

  if requested is null then
    status := 'secilmedi';
  elsif requested = 'ogrenci' then
    status := 'onayli';
  else
    status := 'beklemede';
  end if;

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

-- 9. Kontrol -----------------------------------------------------------------
-- select email, role as aktif, roles from public.users order by email;
