-- ---------------------------------------------------------------------------
-- Cok dersli sinav
--
-- SORUN: `exams.subject` TEK bir ders tutuyor ama sinav birden fazla dersten
-- soru tasiyabiliyor. 2026-08-22-ders-yetkisi.sql bunu zaten fark etmis ve
-- gecmis veriyi doldururken yalnizca TEK dersli sinavlara ders atamis
-- (`subject_count = 1` kosulu); cok dersli olanlari `null` birakmis.
--
-- Ve `teaches_subject(null)` TRUE doner - "dersi olmayan sinav herkese acik".
-- Yani cok dersli sinavlar bugun farkinda olmadan SISTEMDEKI HER EGITMENE
-- gorunuyor. Bu bir sizinti; asagidaki degisiklik onu kapatiyor.
--
-- COZUM: sinavin dersleri artik SORULARINDAN turetilir.
--
--   exam_subjects(sinav)          -> sinavin sorularindaki farkli dersler
--   teaches_exam_subjects(sinav, yedek) -> etkin egitmen bunlardan HERHANGI
--                                          birine yetkili mi
--
-- "Herhangi biri" bilincli bir tercih: Biyoloji+Cografya sinavini yalnizca
-- Biyoloji'ye yetkili bir egitmen de gorur. "Hepsine yetkili olmak" kurali,
-- ortak hazirlanan bir sinavi hazirlayanlarin bile goremedigi durumlar
-- uretirdi.
--
-- Sorusu HENUZ OLMAYAN sinavda ders turetilemez; o durumda eski davranisa
-- (`exams.subject`) dusulur, yani yeni acilmis bos bir sinav bugunku gibi
-- davranir.
--
-- Onkosul: 2026-08-22-ders-yetkisi.sql, ders-yetkisi-bosluklar.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Sinavin dersleri: sorularindan turetilir -------------------------------

create or replace function public.exam_subjects(target_exam uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct btrim(q.subject) order by btrim(q.subject)),
    '{}'::text[]
  )
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  where eq.exam_id = target_exam
    and q.subject is not null
    and btrim(q.subject) <> '';
$$;

grant execute on function public.exam_subjects(uuid) to authenticated;

comment on function public.exam_subjects(uuid) is
  'Sinavin derslerini SORULARINDAN turetir. Sinav birden fazla derse ait olabilir.';


-- 2. Yetki: derslerden HERHANGI birine yetkili olmak yeter ------------------
--
-- `fallback_subject` disaridan parametre olarak aliniyor, fonksiyon icinde
-- `public.exams` OKUNMUYOR. Sebep: bu fonksiyon `exams_select` politikasinin
-- icinden cagriliyor; exams tablosunu orada okumak sonsuz donguye yol acardi.

create or replace function public.teaches_exam_subjects(
  target_exam uuid,
  fallback_subject text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or case
        when cardinality(public.exam_subjects(target_exam)) = 0
          -- Sorusu yok: ders turetilemez, eski davranis gecerli.
          then public.teaches_subject(fallback_subject)
        else exists (
          select 1
          from unnest(public.exam_subjects(target_exam)) as t(ders)
          join public.instructor_subjects s
            on lower(s.subject) = lower(t.ders)
          where s.user_id = auth.uid()
        )
      end
    );
$$;

grant execute on function public.teaches_exam_subjects(uuid, text) to authenticated;

comment on function public.teaches_exam_subjects(uuid, text) is
  'Etkin egitmen sinavin derslerinden HERHANGI birine yetkili mi? Sinavin sorusu yoksa exams.subject uzerinden karar verilir.';


-- 3. Sinav gorunurlugu ------------------------------------------------------

drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    public.is_admin()
    or instructor_id = auth.uid()
    or (
      public.has_role('egitmen')
      and public.teaches_exam_subjects(exams.id, exams.subject)
    )
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (is_published and public.is_exam_assigned_to_current_user(exams.id))
  );


-- 4. Sinav cevresindeki her sey ayni yuklemi kullanir -----------------------
--
-- ders-yetkisi-bosluklar.sql'in tespiti: "can_review_exam() zaten dogru
-- yuklemi tanimliyor; eksik olan onu HER YERDE kullanmakti." Bu yuzden tek
-- ders kontrolunu burada degistirmek sorular, atamalar, cevaplar ve sonuc
-- hesaplamasi dahil butun zincire yansir.

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
          or (
            public.has_role('egitmen')
            and public.teaches_exam_subjects(e.id, e.subject)
          )
        )
    )
  );
$$;

grant execute on function public.can_review_exam(uuid) to authenticated;
