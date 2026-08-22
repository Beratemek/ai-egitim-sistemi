-- ---------------------------------------------------------------------------
-- Sinav suresi (dakika)
--
-- Bugune kadar sinavin tek zaman kisiti PENCEREYDI: starts_at - ends_at.
-- Bu, "sinav 09:00-11:00 arasi acik" demek; "her ogrenciye 40 dakika" demek
-- degil. Ogrenci pencereyi tumuyle kullanabiliyordu.
--
-- `duration_minutes` her OGRENCIYE, denemesini BASLATTIGI andan itibaren
-- taninan sureyi tanimlar. Bos birakilirsa eski davranis surer: yalnizca
-- pencere gecerlidir.
--
-- Etkin bitis = min(pencere sonu, deneme baslangici + sure)
-- Iki kisit da gecerli: 40 dakikasi olan ama pencerenin bitmesine 10 dakika
-- kala baslayan ogrenci 10 dakika alir.
--
-- ONEMLI: kisit ARAYUZDE DEGIL burada zorlanir. Geri sayim sayacini durdurmak
-- cevabin gitmesini engellemez; kural veritabaninda olmazsa istemciden
-- sonsuza kadar cevap gonderilebilirdi.
--
-- Onkosul: uygulandi/20260821203000_student_assessment_security.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Sutun ------------------------------------------------------------------
alter table public.exams
  add column if not exists duration_minutes integer;

alter table public.exams
  drop constraint if exists exams_duration_minutes_check;
alter table public.exams
  add constraint exams_duration_minutes_check
  check (duration_minutes is null or (duration_minutes >= 1 and duration_minutes <= 600));

comment on column public.exams.duration_minutes is
  'Ogrenci basina sinav suresi (dakika). Bos ise yalnizca starts_at/ends_at penceresi gecerlidir.';

-- 2. Etkin bitis anini tek yerde hesapla -----------------------------------
--
-- Ayni mantik uc yerde lazim (cevap yazma, teslim, arayuz); kopyalanirsa
-- biri guncellenip digerleri unutulur.
create or replace function public.exam_attempt_deadline(
  target_exam uuid,
  target_student uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(
    -- Pencere sonu: ogrenciye ozel son tarih varsa o, yoksa sinavinki.
    coalesce(a.due_at, e.ends_at, 'infinity'::timestamptz),
    -- Sure siniri: deneme baslamadiysa sinirsiz sayilir.
    case
      when e.duration_minutes is null or t.started_at is null then 'infinity'::timestamptz
      else t.started_at + make_interval(mins => e.duration_minutes)
    end
  )
  from public.exams e
  left join public.exam_assignments a
    on a.exam_id = e.id and a.student_id = target_student
  left join public.exam_attempts t
    on t.exam_id = e.id and t.student_id = target_student
  where e.id = target_exam;
$$;

grant execute on function public.exam_attempt_deadline(uuid, uuid) to authenticated;

-- 3. Cevap yazma suresi dolunca kapansin -----------------------------------
create or replace function public.guard_student_submission_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role isteklerinde auth.uid() null olur; sunucu puanlama akisi bu
  -- nedenle asagidaki ogrenci kisitlarina girmez.
  if auth.uid() is null or auth.uid() <> new.student_id then
    return new;
  end if;

  if not public.has_role('ogrenci') then
    raise exception 'Yalnizca ogrenci kendi cevabini kaydedebilir.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.exam_assignments assignment
    join public.exam_attempts attempt
      on attempt.exam_id = assignment.exam_id
     and attempt.student_id = assignment.student_id
    join public.exams exam on exam.id = assignment.exam_id
    join public.exam_questions exam_question
      on exam_question.exam_id = assignment.exam_id
     and exam_question.question_id = new.question_id
    where assignment.exam_id = new.exam_id
      and assignment.student_id = new.student_id
      and attempt.status = 'devam_ediyor'
      and exam.is_published
      and (exam.starts_at is null or exam.starts_at <= now())
      -- Pencere VE sure birlikte: hangisi once biterse o baglar.
      and public.exam_attempt_deadline(new.exam_id, new.student_id) >= now()
  ) then
    raise exception 'Sinav oturumu cevap kaydetmeye acik degil.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'gonderildi'
       or new.ai_score is not null
       or new.ai_feedback is not null
       or new.ai_criteria_json <> '[]'::jsonb
       or new.instructor_approved_score is not null
       or new.instructor_note is not null
       or new.reviewed_by is not null
    then
      raise exception 'Degerlendirme alanlari ogrenci tarafindan yazilamaz.'
        using errcode = '42501';
    end if;
  elsif new.exam_id is distinct from old.exam_id
     or new.question_id is distinct from old.question_id
     or new.student_id is distinct from old.student_id
     or new.status is distinct from old.status
     or new.ai_score is distinct from old.ai_score
     or new.ai_feedback is distinct from old.ai_feedback
     or new.ai_criteria_json is distinct from old.ai_criteria_json
     or new.instructor_approved_score is distinct from old.instructor_approved_score
     or new.instructor_note is distinct from old.instructor_note
     or new.reviewed_by is distinct from old.reviewed_by
  then
    raise exception 'Ogrenci yalnizca taslak cevap metnini degistirebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- 4. Soru puani sifir olamaz -----------------------------------------------
--
-- Egitmen artik puanlari elle giriyor. Toplam puan sifir olursa sonuc
-- hesaplama fonksiyonu bolme yapamaz ve sinav asla sonuclanmaz.
alter table public.exam_questions
  drop constraint if exists exam_questions_points_check;
alter table public.exam_questions
  add constraint exam_questions_points_check
  check (points > 0 and points <= 100);

commit;

-- 5. Kontrol ---------------------------------------------------------------
-- select title, duration_minutes, starts_at, ends_at from public.exams;
-- select public.exam_attempt_deadline('<sinav-id>', '<ogrenci-id>');
