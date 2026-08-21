-- ---------------------------------------------------------------------------
-- Siniflar (derslikler) ve sinifa sinav atama
--
-- Ogrenciye tek tek sinav atamak yerine SINIFA atanir: "Derslik-3'e biyoloji
-- sinavi". Sinif bilgisi ogrencinin profilinde durur ve yalnizca sistem
-- yoneticisi tarafindan belirlenir.
--
-- Onkosul: admin rolu migration'lari (2026-08-22-admin-rolu-*).
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Ogrencinin sinifi -------------------------------------------------------
alter table public.users add column if not exists classroom text;

comment on column public.users.classroom is
  'Ogrencinin sinifi/derslik adi. Sistem yoneticisi atar; sinav atamalari bunun uzerinden yapilir.';

create index if not exists users_classroom_idx on public.users (classroom);

-- 2. Sinif atama (yalnizca admin) --------------------------------------------
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

  update public.users
  set classroom  = cleaned,
      updated_at = now()
  where id = target_user;

  return cleaned;
end;
$$;

grant execute on function public.set_user_classroom(uuid, text) to authenticated;

-- 3. Sinifa sinav atama ------------------------------------------------------
-- Sinifin TUM ogrencilerine tek islemde atama acar. Zaten atanmis olanlar
-- sessizce atlanir; boylece ayni sinif ikinci kez atandiginda hata olmaz.
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
    where role = 'ogrenci'
      and role_status = 'onayli'
      and classroom = btrim(target_classroom)
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

-- 4. Sinifin atamasini kaldirma ---------------------------------------------
-- Cevap vermis ogrencinin atamasi KORUNUR; verdigi cevap ortada kalmasin.
create or replace function public.unassign_exam_from_classroom(
  target_exam uuid,
  target_classroom text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  silinen integer;
begin
  if not public.can_manage_exam(target_exam) then
    raise exception 'Bu sinavi atama yetkiniz yok.' using errcode = '42501';
  end if;

  with silinenler as (
    delete from public.exam_assignments assignment
    using public.users student
    where assignment.exam_id = target_exam
      and assignment.student_id = student.id
      and student.classroom = btrim(target_classroom)
      and not exists (
        select 1 from public.exam_attempts attempt
        where attempt.exam_id = target_exam
          and attempt.student_id = student.id
      )
    returning 1
  )
  select count(*) into silinen from silinenler;

  return silinen;
end;
$$;

grant execute on function public.unassign_exam_from_classroom(uuid, text) to authenticated;

-- 5. Kontrol -----------------------------------------------------------------
-- select email, role, classroom from public.users where role = 'ogrenci';
