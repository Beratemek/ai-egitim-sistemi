-- ---------------------------------------------------------------------------
-- Sinifi olmayan ogrenci sinav cozemesin
--
-- Kural: sinavlar SINIF BAZLI atanir. Dolayisiyla sinifi olmayan ogrencinin
-- cozebilecegi bir sinav da olmamali. Bugun bu kural yalnizca ATAMA
-- fonksiyonunda vardi; cevresindeki kapilar acikti:
--
--   1. start_exam_attempt sinifa HIC bakmiyordu. Elinde bir atama satiri olan
--      sinifsiz ogrenci sinavi baslatip cozebiliyordu. Bu teorik degil:
--      20260821170000 numarali migration, gecis sirasinda yayindaki her sinavi
--      MEVCUT TUM ogrencilere atamisti - o satirlar hala duruyor.
--   2. exam_assignments'a dogrudan yazma yalnizca can_manage_exam ile
--      korunuyordu. Egitmen PostgREST ile istedigi student_id icin atama
--      satiri ekleyebiliyor, assign_exam_to_classroom'daki sinif filtresini
--      tumuyle atlayabiliyordu.
--   3. assign_exam_to_classroom ogrencileri `role = 'ogrenci'` ile ariyordu -
--      yani ETKIN rol. Coklu rolde ogrenci rolu VERILMIS ama o an egitmen
--      panelinde olan kullanici atamanin disinda kaliyordu.
--
-- Yaklasim: kural tek bir yerde, TETIKLEYICIDE. Politikayi daraltmak yetmez,
-- cunku atama satiri SECURITY DEFINER fonksiyonlardan da yaziliyor; tetikleyici
-- her yolu ayni anda kapatir.
--
-- Onkosul: uygulandi/2026-08-22-sinif-ve-atama.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Atama satiri sinifsiz ogrenciye yazilamasin ----------------------------
create or replace function public.guard_assignment_requires_classroom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ogrenci_sinifi text;
begin
  select classroom into ogrenci_sinifi
  from public.users
  where id = new.student_id;

  if nullif(btrim(coalesce(ogrenci_sinifi, '')), '') is null then
    raise exception
      'Bu ogrencinin sinifi atanmamis; sinavlar sinif bazli atanir. Once sistem yoneticisi bir sinif atamali.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists exam_assignments_require_classroom on public.exam_assignments;
create trigger exam_assignments_require_classroom
  before insert or update on public.exam_assignments
  for each row execute function public.guard_assignment_requires_classroom();

-- 2. Sinavi baslatmak icin de sinif sart -----------------------------------
--
-- Atama tarafi kapansa bile ESKI satirlar duruyor; giris kapisi da kontrol
-- etmeli. Ayrica sinifi sonradan alinan ogrenci devam edememeli.
create or replace function public.start_exam_attempt(target_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  attempt_id uuid;
begin
  if actor is null then raise exception 'Oturum acmaniz gerekiyor.'; end if;

  if not exists (
    select 1 from public.users u
    where u.id = actor
      and nullif(btrim(coalesce(u.classroom, '')), '') is not null
  ) then
    raise exception
      'Sinifiniz atanmadigi icin sinava giremezsiniz. Sistem yoneticisi sinifinizi atadiginda sinavlariniz gorunur.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.exam_assignments a
    join public.exams e on e.id = a.exam_id
    where a.exam_id = target_exam
      and a.student_id = actor
      and e.is_published
      and (e.starts_at is null or e.starts_at <= now())
      and (coalesce(a.due_at, e.ends_at) is null or coalesce(a.due_at, e.ends_at) >= now())
  ) then
    raise exception 'Bu sinav size atanmamis veya cevaplamaya acik degil.';
  end if;

  insert into public.exam_attempts (exam_id, student_id)
  values (target_exam, actor)
  on conflict (exam_id, student_id) do nothing;

  select id into attempt_id
  from public.exam_attempts
  where exam_id = target_exam and student_id = actor;

  return attempt_id;
end;
$$;

revoke all on function public.start_exam_attempt(uuid) from public;
grant execute on function public.start_exam_attempt(uuid) to authenticated;

-- 3. Atama, VERILMIS rollere baksin ----------------------------------------
--
-- `role` etkin roldur ve rol degistiriciyle degisir; yetkinin kaynagi
-- `roles` kumesidir. Onceki hali, ogrenci rolu olan ama o an baska bir
-- panelde calisan kullaniciyi atamanin disinda birakiyordu.
create or replace function public.assign_exam_to_classroom(
  target_exam uuid,
  target_classroom text,
  due_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  eklenen integer;
begin
  if not public.can_manage_exam(target_exam) then
    raise exception 'Bu sinavi atama yetkiniz yok.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(target_classroom, '')), '') is null then
    raise exception 'Sinif secilmedi.' using errcode = '22023';
  end if;

  with hedef as (
    select id
    from public.users
    where role_status = 'onayli'
      and classroom = btrim(target_classroom)
      and (
        'ogrenci' = any(roles)
        or (cardinality(roles) = 0 and role = 'ogrenci')
      )
  ),
  eklenenler as (
    insert into public.exam_assignments (exam_id, student_id, assigned_by, due_at)
    select target_exam, hedef.id, auth.uid(), due_at from hedef
    on conflict (exam_id, student_id) do nothing
    returning 1
  )
  select count(*) into eklenen from eklenenler;

  return eklenen;
end;
$$;

grant execute on function public.assign_exam_to_classroom(uuid, text, timestamptz) to authenticated;

-- 4. Sinif kaldirilinca atamalar de dusulsun -------------------------------
--
-- Sinifi alinan ogrencinin bekleyen sinavi kalmamali. BASLANMIS sinavlara
-- dokunulmaz: cevap vermis ogrencinin kagidini silmek veri kaybi olurdu,
-- bu yuzden yalnizca denemesi olmayan atamalar kaldirilir - ayni kural
-- unassign_exam_from_classroom icinde de var.
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

  if cleaned is null then
    delete from public.exam_assignments a
    where a.student_id = target_user
      and not exists (
        select 1 from public.exam_attempts t
        where t.exam_id = a.exam_id and t.student_id = target_user
      );
  end if;

  return cleaned;
end;
$$;

grant execute on function public.set_user_classroom(uuid, text) to authenticated;

-- 5. Gecmisten kalan sinifsiz atamalari temizle ----------------------------
--
-- 20260821170000 gecis adiminin herkese dagittigi satirlar. Baslanmis
-- sinavlara dokunulmaz; onlar gecmis kaydi olarak kalir.
delete from public.exam_assignments a
using public.users u
where a.student_id = u.id
  and nullif(btrim(coalesce(u.classroom, '')), '') is null
  and not exists (
    select 1 from public.exam_attempts t
    where t.exam_id = a.exam_id and t.student_id = a.student_id
  );

commit;

-- 6. Kontrol ---------------------------------------------------------------
-- Sifir satir donmeli:
--   select count(*) from public.exam_assignments a
--   join public.users u on u.id = a.student_id
--   where coalesce(btrim(u.classroom), '') = '';
