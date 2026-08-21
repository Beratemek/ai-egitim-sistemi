-- ---------------------------------------------------------------------------
-- Ders yetkisi - kalan yetki bosluklarini kapat
--
-- 2026-08-22-ders-yetkisi.sql yalnizca UC yeri genisletti: exams_select,
-- submissions (select + update) ve exam_attempts_select. Ayni sinavin
-- cevresindeki diger tablolar hala YALNIZCA SAHIBI taniyan can_manage_exam()
-- kullaniyordu. Sonuc: derse yetkili bir egitmen sinavi ve cevaplari goruyor
-- ama sorulari goremiyor, atamalari goremiyor ve onay verdiginde sonuc
-- hesaplanamiyor.
--
-- Bu dosya o uc bosluğu kapatir. can_review_exam() zaten dogru yuklemi
-- tanimliyor; eksik olan onu HER YERDE kullanmakti.
--
-- Onkosul: 2026-08-22-ders-yetkisi.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Sinavin sorulari ------------------------------------------------------
--
-- Derse yetkili egitmen cevabi goruyordu ama SORUYU goremiyordu; kontrol
-- ekraninda "Soru bulunamadi" yaziyordu. can_manage_exam yalnizca sahibi,
-- yoneticiyi ve egitim yoneticisini taniyor.
drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    public.is_admin()
    or public.can_review_exam(exam_id)
    or public.has_role('icerik_uzmani')
    or public.is_exam_assigned_to_current_user(exam_id)
  );

-- 2. Sinav atamalari -------------------------------------------------------
--
-- Sinif kutucugundaki "kac ogrenciye atandi" sayisi bu tablodan geliyor.
-- Gorulemedigi icin assignedCount 0 kaliyor, teslim orani da 0/0 -> ekran
-- yanlis bilgi gosteriyordu.
drop policy if exists "exam_assignments_select" on public.exam_assignments;
create policy "exam_assignments_select" on public.exam_assignments
  for select using (
    student_id = auth.uid()
    or public.is_admin()
    or public.can_review_exam(exam_id)
  );

-- 3. Sonuc hesaplama -------------------------------------------------------
--
-- EN ONEMLISI: submissions UPDATE politikasi can_review_exam'e genisletildi,
-- ama bu fonksiyonun ic kontrolu hala sahip/egitim_yoneticisi istiyordu.
-- Derse yetkili egitmen onay verdiginde PUAN YAZILIYOR, ardindan bu fonksiyon
-- "yetkiniz yok" diye patliyor: cevap onayli gorunuyor ama ogrencinin sinavi
-- asla sonuclanmiyor. Govde degismedi, yalnizca yetki kontrolu duzeltildi.
create or replace function public.recalculate_exam_attempt_result(
  target_exam uuid,
  target_student uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  question_count integer;
  approved_count integer;
  earned numeric(8,2);
  total numeric(8,2);
begin
  if not (public.is_admin() or public.can_review_exam(target_exam)) then
    raise exception 'Bu sonucu hesaplama yetkiniz yok.' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(points), 0)
  into question_count, total
  from public.exam_questions
  where exam_id = target_exam;

  select
    count(*),
    coalesce(sum(eq.points * s.instructor_approved_score / 100.0), 0)
  into approved_count, earned
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
   and s.student_id = target_student
  where eq.exam_id = target_exam
    and s.status = 'egitmen_onayli'
    and s.instructor_approved_score is not null;

  if question_count = 0 or approved_count < question_count or total <= 0 then
    return false;
  end if;

  update public.exam_attempts
  set
    status = 'sonuclandi',
    submitted_at = coalesce(submitted_at, now()),
    completed_at = now(),
    earned_points = round(earned, 2),
    total_points = round(total, 2),
    final_score = round(earned / total * 100.0, 2)
  where exam_id = target_exam and student_id = target_student;

  return found;
end;
$$;

revoke all on function public.recalculate_exam_attempt_result(uuid, uuid) from public;
grant execute on function public.recalculate_exam_attempt_result(uuid, uuid) to authenticated;

commit;

-- 4. Kontrol ---------------------------------------------------------------
-- select polname from pg_policy
--   where polrelid in ('public.exam_questions'::regclass,
--                      'public.exam_assignments'::regclass);
