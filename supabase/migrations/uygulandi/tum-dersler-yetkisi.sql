-- ---------------------------------------------------------------------------
-- "Tum dersler" yetkisi
--
-- Bir egitmene tek tek her dersi isaretlemek iki turlu yetersiz:
--   1. Ders sayisi arttikca isaretleme isi buyuyor.
--   2. Daha onemlisi, SONRADAN eklenen ders o hocayi KAPSAMAZ. Icerik uzmani
--      yeni bir ders adiyla soru uretince, "her derse yetkili" olmasi
--      beklenen hoca o dersin sinavlarini goremez hale gelir.
--
-- Cozum: `instructor_subjects` icinde JOKER bir kayit. subject = '*' olan
-- satir "bu kullanici her derse yetkilidir" demektir ve ders listesinden
-- bagimsizdir, yani yarin eklenen dersi de kapsar.
--
-- Yeni sutun ya da tablo gerekmiyor; mevcut anahtar (user_id, subject) joker
-- satiri da dogal olarak tekil tutuyor.
--
-- Onkosul: uygulandi/2026-08-22-ders-yetkisi.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Joker degeri tek yerde tanimla ----------------------------------------
--
-- '*' bir ders adi olarak yazilamaz: set_instructor_subjects disaridan gelen
-- degerleri kirpiyor ve arayuz ders adlarini soru havuzundan turetiyor, ama
-- yine de anlami tek bir yerden okunabilsin.
create or replace function public.all_subjects_token()
returns text
language sql
immutable
as $$ select '*'::text $$;

grant execute on function public.all_subjects_token() to authenticated;

-- 2. teaches_subject joker kaydi tanisin -----------------------------------
create or replace function public.teaches_subject(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      target is null
      or btrim(target) = ''
      or public.is_admin()
      or exists (
        select 1 from public.instructor_subjects s
        where s.user_id = auth.uid()
          and (
            -- Joker: her derse yetkili, ileride eklenecekler dahil.
            s.subject = '*'
            or lower(s.subject) = lower(btrim(target))
          )
      )
    );
$$;

grant execute on function public.teaches_subject(text) to authenticated;

-- 3. Yetki atamasi jokeri kabul etsin --------------------------------------
--
-- Joker secildiginde tek tek dersler ANLAMSIZ hale gelir; ikisini birlikte
-- saklamak "hem hepsi hem bazilari" gibi tutarsiz bir kayit birakirdi.
-- Joker varsa yalnizca o yazilir.
create or replace function public.set_instructor_subjects(
  target_user uuid,
  subjects text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text[];
begin
  if not public.is_admin() then
    raise exception 'Bu islem icin sistem yoneticisi olmalisiniz.'
      using errcode = '42501';
  end if;

  if target_user is null then
    raise exception 'Kullanici secilmedi.' using errcode = '22023';
  end if;

  -- Bos ve yinelenen degerleri at; bastaki/sondaki bosluklari kirp.
  select coalesce(array_agg(distinct btrim(value)), array[]::text[])
  into cleaned
  from unnest(coalesce(subjects, array[]::text[])) as value
  where btrim(value) <> '';

  -- Joker varsa diger her sey dusulur.
  if '*' = any(cleaned) then
    cleaned := array['*'];
  end if;

  delete from public.instructor_subjects
  where user_id = target_user
    and not (subject = any(cleaned));

  insert into public.instructor_subjects (user_id, subject, granted_by)
  select target_user, value, auth.uid()
  from unnest(cleaned) as value
  on conflict (user_id, subject) do nothing;

  return cleaned;
end;
$$;

grant execute on function public.set_instructor_subjects(uuid, text[]) to authenticated;

commit;

-- 4. Kontrol ---------------------------------------------------------------
-- Bir egitmene joker verildikten sonra her dersin sinavini gormeli:
--   select public.teaches_subject('Biyoloji'), public.teaches_subject('Yeni Ders');
