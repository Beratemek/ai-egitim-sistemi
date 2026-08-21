-- ---------------------------------------------------------------------------
-- Ogrenci kendi sinifini degistirebiliyordu
--
-- `users_update_self` politikasi SUTUN KISITI TASIMIYOR: kullanici kendi
-- satirinin her alanini yazabilir. Rol alanlari `guard_role_columns`
-- tetikleyicisiyle korunuyordu ama tetikleyici yalnizca dort sutunu
-- kapsiyordu: role, roles, role_status, requested_role.
--
-- `classroom` acikta kalmisti. Ogrenci dogrudan PostgREST cagrisiyla
--     PATCH /rest/v1/users?id=eq.<kendi-id> { "classroom": "Derslik-3" }
-- yazip kendini baska bir derslige alabilir, o dersligin sinavlarini almaya
-- baslayabilirdi. Sinif atamasinin SISTEM YONETICISININ isi olmasinin bir
-- anlami kalmiyordu.
--
-- `email` de ayni sekilde acikti: gorunen kimligi degistirmeye yariyordu.
-- Kodda insert disinda bu iki sutuna yazan hicbir yer yok, bu yuzden
-- korumaya almak mevcut akislari bozmuyor.
--
-- Onkosul: 2026-08-22-coklu-rol.sql, 2026-08-22-sinif-ve-atama.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Tetikleyici sinif ve e-postayi da korusun -----------------------------
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
      or new.requested_role is distinct from old.requested_role
      or new.classroom is distinct from old.classroom
      or new.email is distinct from old.email)
     and coalesce(current_setting('app.role_change_allowed', true), 'off') <> 'on'
  then
    raise exception 'Bu alanlar dogrudan degistirilemez; ilgili fonksiyonlari kullanin.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 2. Sinif atama fonksiyonu bayragi kaldirsin ------------------------------
--
-- Tetikleyici artik classroom'u da kestigi icin, mesru tek yazma yolu olan bu
-- fonksiyonun kendi yazmasina izin vermesi gerekiyor. `set_config`in ucuncu
-- argumani true: ayar YALNIZCA bu islem boyunca gecerli, oturuma sizmaz.
create or replace function public.set_user_classroom(
  target_user uuid,
  new_classroom text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  if not public.is_admin() then
    raise exception 'Sinif atamasi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.users where id = target_user) then
    raise exception 'Kullanici bulunamadi.' using errcode = '22023';
  end if;

  cleaned := nullif(btrim(coalesce(new_classroom, '')), '');

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set classroom  = cleaned,
      updated_at = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return cleaned;
end;
$$;

grant execute on function public.set_user_classroom(uuid, text) to authenticated;

commit;

-- 3. Kontrol ---------------------------------------------------------------
-- Ogrenci oturumuyla denendiginde 42501 dondurmeli:
--   update public.users set classroom = 'Derslik-9' where id = auth.uid();
