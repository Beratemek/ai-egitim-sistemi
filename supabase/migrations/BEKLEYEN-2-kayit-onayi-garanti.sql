-- ---------------------------------------------------------------------------
-- Kayit onayi: her yeni kullanici onay kuyruguna dussun (GARANTI)
--
-- NEDEN: Bir kullanici kaydoldu ama "Rol Onaylari" ekraninda gorunmedi.
-- Kural `uygulandi/tum-roller-onaya-dussun.sql` ile zaten getirilmisti, ama
-- o dosyanin gercekten calistirildigini kimse dogrulayamiyor - dosyanin
-- `uygulandi/` klasorunde durmasi ELLE tasindigi anlamina geliyor, calistigi
-- anlamina degil.
--
-- Ayrica `supabase/schema.sql` bu iki fonksiyonun ESKI halini tasiyor
-- (ogrenci -> dogrudan 'onayli') ve dosya kendini "tamamini yapistirip
-- calistirin" diye tanitiyor. Biri o talimata uyduysa kural sessizce geri
-- alinmis olabilir.
--
-- Bu dosya iki fonksiyonu KESIN olarak dogru haline getirir. Zaten dogruysa
-- hicbir sey degistirmez; yanlissa duzeltir. Idempotenttir, tekrar tekrar
-- calistirilabilir.
--
-- KURAL: rol secilerek yapilan her kayit 'beklemede' ile baslar - ogrenci
-- dahil. Sisteme kimin girdigi tumuyle sistem yoneticisinin kontrolunde.
-- Rol hic secilmemisse (or. Google ile ilk giris) 'secilmedi' olur ve kisi
-- once /hosgeldiniz ekraninda rolunu secer, sonra kuyruga duser.
-- ---------------------------------------------------------------------------

-- 1. Yeni kayit -------------------------------------------------------------
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

-- Tetikleyicinin gercekten bagli oldugunu da garantiye al: fonksiyon dogru
-- olsa bile tetikleyici dusmusse hicbir profil olusmaz.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Sonradan rol talebi ----------------------------------------------------
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

-- 3. Kontrol ----------------------------------------------------------------
--
-- Calistiktan sonra bunu isletin; son kaydolanlarin durumu gorunur:
--
--   select email, role, roles, role_status, requested_role, created_at
--   from public.users
--   order by created_at desc
--   limit 10;
--
--
-- ESKI KURALLA KAYDOLMUS BIRINI KUYRUGA ALMAK
--
-- Bu dosya YALNIZCA bundan sonraki kayitlari etkiler; gecmiste 'onayli'
-- almis kisiler oldugu yerde kalir. Bu BILEREK boyle: toplu bir guncelleme
-- su an calisan herkesi - sizin hesabinizi da - disari atabilirdi.
--
-- Belirli bir kisiyi kuyruga almak isterseniz e-postasini yazip su satiri
-- elle calistirin (basindaki yorum isaretlerini kaldirarak):
--
--   update public.users
--   set role_status = 'beklemede', requested_role = coalesce(requested_role, role)
--   where email = 'arkadasin@ornek.com';
--
-- Kendi hesabinizda CALISTIRMAYIN: kendinizi onay bekleyen duruma dusurup
-- panele giremez hale gelirsiniz.
