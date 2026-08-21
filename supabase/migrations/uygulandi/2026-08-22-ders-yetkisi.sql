-- ---------------------------------------------------------------------------
-- Ders yetkisi: matematik hocasi Derslik-3'un biyoloji sinavini gormesin
--
-- Bugunku durum: `submissions_select` politikasi "public.has_role('egitmen')"
-- diyor, yani HERHANGI bir egitmen SISTEMDEKI TUM cevaplari okuyabiliyor.
-- Sinav gorunurlugu kisitli olsa bile cevaplar acikta. Bu dosya yetkinin
-- gercek dayanagini kuruyor: DERS.
--
-- Model:
--   * instructor_subjects  -> hangi egitmen hangi derse yetkili (cok-cok)
--   * exams.subject        -> sinavin dersi (sinav basina TEK ders)
--   * teaches_subject()    -> etkin kullanici bu derse yetkili mi
--   * can_review_exam()    -> bu sinavi gorup degerlendirebilir mi
--
-- Dersi ATANMAMIS (null/bos) sinav tum egitmenlere aciktir. Bunun yonu
-- bilerek boyle: "dersi olmayan egitmen her seyi gorsun" deseydik, sistem
-- yoneticisi bir hocanin derslerini SILDIGINDE yetkisi GENISLERDI. Tersi
-- guvenli - ders atanmamis hoca yalnizca kendi sinavlarini gorur.
--
-- Onkosul: 2026-08-22-coklu-rol.sql, 2026-08-22-sinif-ve-atama.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Tablolar ve sutunlar ---------------------------------------------------

create table if not exists public.instructor_subjects (
  user_id    uuid not null references public.users(id) on delete cascade,
  subject    text not null,
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, subject)
);

alter table public.instructor_subjects enable row level security;

create index if not exists instructor_subjects_subject_idx
  on public.instructor_subjects (subject);

alter table public.exams
  add column if not exists subject text;

create index if not exists exams_subject_idx on public.exams (subject);

-- 2. Mevcut sinavlara ders doldur ------------------------------------------
--
-- Sinavin sorulari tek bir derse aitse sinavin dersi odur. Karisik ya da
-- dersi belirsiz sinavlar null kalir ve herkese acik olmayi surdurur -
-- gecmis veriyi tahminle kilitlemek dogru olmaz.
update public.exams e
set subject = sub.only_subject
from (
  select eq.exam_id,
         min(q.subject) as only_subject,
         count(distinct q.subject) as subject_count
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  where q.subject is not null and btrim(q.subject) <> ''
  group by eq.exam_id
) as sub
where e.id = sub.exam_id
  and sub.subject_count = 1
  and e.subject is null;

-- 3. Yardimci fonksiyonlar --------------------------------------------------

/**
 * Etkin kullanici bu derse yetkili mi?
 *
 * Ders atanmamis (null/bos) icerik herkese aciktir - bkz. dosya basi.
 */
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
          and lower(s.subject) = lower(btrim(target))
      )
    );
$$;

grant execute on function public.teaches_subject(text) to authenticated;

/**
 * Bu sinavi gorup degerlendirebilir mi?
 *
 * Sahibi her zaman gorur: kendi hazirladigi sinavdan kilitlenmemeli.
 * Diger egitmenler yalnizca YETKILI OLDUKLARI DERSTEN gorur.
 */
create or replace function public.can_review_exam(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam
        and (
          e.instructor_id = auth.uid()
          or (public.has_role('egitmen') and public.teaches_subject(e.subject))
        )
    )
  );
$$;

grant execute on function public.can_review_exam(uuid) to authenticated;

/** Etkin kullanicinin yetkili oldugu dersler; profil ekrani icin. */
create or replace function public.my_subjects()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select array_agg(s.subject order by s.subject)
     from public.instructor_subjects s
     where s.user_id = auth.uid()),
    array[]::text[]
  );
$$;

grant execute on function public.my_subjects() to authenticated;

-- 4. Ders yetkisini SISTEM YONETICISI atar ---------------------------------
--
-- Egitmen kendi ders listesini duzenleyebilseydi yetki yukseltme kapisi
-- acilirdi; bu yuzden yazma yalnizca bu fonksiyondan ve yalnizca admin icin.
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

-- 5. instructor_subjects politikalari --------------------------------------

drop policy if exists "instructor_subjects_select" on public.instructor_subjects;
create policy "instructor_subjects_select" on public.instructor_subjects
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role('egitim_yoneticisi')
  );

-- Yazma yalnizca set_instructor_subjects uzerinden. Dogrudan INSERT/UPDATE/
-- DELETE icin politika YOK: RLS acik oldugu icin hepsi reddedilir.
drop policy if exists "instructor_subjects_write" on public.instructor_subjects;

-- 6. Sinav gorunurlugu ------------------------------------------------------

drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    public.is_admin()
    or instructor_id = auth.uid()
    or (public.has_role('egitmen') and public.teaches_subject(subject))
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (is_published and public.is_exam_assigned_to_current_user(exams.id))
  );

-- 7. Cevaplar ve denemeler --------------------------------------------------
--
-- ASIL SIZINTI BURADAYDI: onceki politika "public.has_role('egitmen')" idi,
-- yani her egitmen sistemdeki her cevabi okuyabiliyordu. Artik cevap, ait
-- oldugu SINAVIN yetkisine bagli.
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (public.can_review_exam(exam_id));

drop policy if exists "submissions_update_egitmen" on public.submissions;
create policy "submissions_update_egitmen" on public.submissions
  for update using (public.can_review_exam(exam_id))
  with check (public.can_review_exam(exam_id));

drop policy if exists "exam_attempts_select" on public.exam_attempts;
create policy "exam_attempts_select" on public.exam_attempts
  for select using (
    student_id = auth.uid()
    or public.can_review_exam(exam_id)
  );

-- 8. Kontrol ---------------------------------------------------------------
-- select id, title, subject from public.exams order by created_at desc;
-- select u.email, s.subject from public.instructor_subjects s
--   join public.users u on u.id = s.user_id order by u.email, s.subject;
-- select public.my_subjects();
