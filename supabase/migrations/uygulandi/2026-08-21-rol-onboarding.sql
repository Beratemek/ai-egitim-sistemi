-- ---------------------------------------------------------------------------
-- Rol secimi ve onay akisi
--
-- Calisan bir veritabanina uygulanacak fark. `supabase/schema.sql` zaten bu
-- hali icerir; bu dosya semayi sifirdan kurmadan ayni noktaya gelmek icindir.
-- Idempotenttir, birden fazla calistirilabilir.
--
-- Calistirma: Supabase Dashboard -> SQL Editor -> New query -> yapistir -> Run
-- ---------------------------------------------------------------------------

-- 1. Rol onay durumu enum'u ------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_status') then
    create type public.role_status as enum (
      'secilmedi',    -- ilk giristen sonra rolunu henuz secmedi
      'beklemede',    -- rol talep etti, egitim yoneticisi onayi bekliyor
      'onayli',       -- rolu gecerli
      'reddedildi'    -- talebi reddedildi; yeni talep acabilir
    );
  end if;
end $$;

-- 2. users tablosuna onay alanlari -----------------------------------------
-- Varsayilan 'onayli': mevcut kullanicilar oldugu gibi calismaya devam eder.
alter table public.users add column if not exists role_status public.role_status not null default 'onayli';
alter table public.users add column if not exists requested_role public.user_role;
alter table public.users add column if not exists role_reviewed_by uuid;
alter table public.users add column if not exists role_reviewed_at timestamptz;

create index if not exists users_role_status_idx on public.users (role_status);

-- 3. Yeni kayit tetikleyicisi ----------------------------------------------
-- Rol artik dogrudan verilmez, TALEP edilir.
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

  insert into public.users (id, role, role_status, requested_role, full_name, email)
  values (
    new.id,
    'ogrenci',
    status,
    requested,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 4. Rol alanlarini dogrudan yazmayi engelle -------------------------------
-- `users_update_self` politikasi kullanicinin kendi satirini guncellemesine
-- izin veriyor; sutun bazinda kisitlama olmadigi icin herkes kendi rolunu
-- 'egitim_yoneticisi' yapabilirdi. Asagidaki tetikleyici bu yolu kapatir:
-- rol alanlari yalnizca SECURITY DEFINER fonksiyonlarindan degisebilir.
create or replace function public.guard_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.role_status is distinct from old.role_status
      or new.requested_role is distinct from old.requested_role)
     and coalesce(current_setting('app.role_change_allowed', true), 'off') <> 'on'
  then
    raise exception 'Rol alanlari dogrudan degistirilemez; request_role / review_role_request kullanin.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_role_columns on public.users;
create trigger users_guard_role_columns
  before update on public.users
  for each row execute function public.guard_role_columns();

-- 5. Rol talebi -------------------------------------------------------------
create or replace function public.request_role(target public.user_role)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.role_status;
begin
  if auth.uid() is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  result := case when target = 'ogrenci' then 'onayli' else 'beklemede' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = 'ogrenci',
      requested_role   = target,
      role_status      = result,
      role_reviewed_by = null,
      role_reviewed_at = null,
      updated_at       = now()
  where id = auth.uid();

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 6. Talebi karara baglama --------------------------------------------------
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
  if not public.has_role('egitim_yoneticisi') then
    raise exception 'Bu islem icin egitim yoneticisi olmaniz gerekiyor.'
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
  set role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 7. ILK EGITIM YONETICISI --------------------------------------------------
-- Onaylayacak kimse yoksa her talep sonsuza kadar bekler.
--
-- YUKARIDAKI 1-6 ADIMLARI CALISTIKTAN SONRA, asagidaki blogun yorumunu kaldirip
-- e-postayi kendi hesabinizla degistirerek calistirin.
--
-- Tek bir DO blogu olmasi onemli: `set_config(..., true)` islem (transaction)
-- kapsaminda gecerlidir. Ayri ifadeler halinde calistirilirsa bayrak UPDATE'e
-- ulasmaz ve koruma tetikleyicisi guncellemeyi reddeder.
--
-- do $$
-- begin
--   perform set_config('app.role_change_allowed', 'on', true);
--
--   update public.users
--      set role           = 'egitim_yoneticisi',
--          role_status    = 'onayli',
--          requested_role = null
--    where email = 'admin@t3.com';
--
--   perform set_config('app.role_change_allowed', 'off', true);
-- end $$;
