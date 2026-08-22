-- ---------------------------------------------------------------------------
-- Öğrenci soruyu boş bırakabilsin
--
-- Bugünkü davranış: `submit_exam_attempt` her sorunun cevaplanmış olmasını
-- şart koşuyor ve aksi halde sınavı teslim ETTİRMİYOR. Gerçek bir sınavda
-- öğrenci bilmediği soruyu boş bırakır; bilmediği için teslim edememek
-- kâğıdı elinde kalmak demek.
--
-- İki yerde birden düzeltilmesi gerekiyor:
--
--   TESLIM      Kaç soru cevaplanmış olursa olsun sınav teslim edilebilmeli.
--   SONUÇLANMA  `recalculate_exam_attempt_result` "her sorunun onaylı bir
--               cevabı var mı" diye bakıyordu. Boş bırakılan sorunun cevabı
--               hiç oluşmadığı için o koşul asla sağlanmaz ve sınav sonsuza
--               kadar "değerlendiriliyor"da kalırdı.
--
-- Boş soru 0 puan sayılır - kâğıt sınavında da öyle.
--
-- Önkoşul: uygulandi/ders-yetkisi-bosluklar.sql (can_review_exam)
-- Idempotenttir.
-- ---------------------------------------------------------------------------

begin;

-- 1. Teslim: cevap sayısı şart değil ---------------------------------------
create or replace function public.submit_exam_attempt(target_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  attempt_id uuid;
  question_count integer;
begin
  if actor is null then raise exception 'Oturum acmaniz gerekiyor.'; end if;

  select count(*) into question_count
  from public.exam_questions
  where exam_id = target_exam;

  -- Sorusu olmayan sinav teslim edilemez; teslim edecek bir sey yok.
  if question_count = 0 then
    raise exception 'Bu sinavda soru yok.' using errcode = '22023';
  end if;

  -- Cevaplanan soru sayisi ARTIK KONTROL EDILMIYOR: bos birakmak
  -- ogrencinin hakki.
  update public.exam_attempts
  set status = 'degerlendiriliyor', submitted_at = coalesce(submitted_at, now())
  where exam_id = target_exam
    and student_id = actor
    and status = 'devam_ediyor'
  returning id into attempt_id;

  if attempt_id is null then
    select id into attempt_id from public.exam_attempts
    where exam_id = target_exam and student_id = actor;
  end if;

  return attempt_id;
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

-- 2. Sonuclanma: bos sorular 0 puan ----------------------------------------
--
-- Eski kosul "onayli cevap sayisi = soru sayisi" idi. Bos birakilan sorunun
-- submissions satiri hic olusmadigi icin bu kosul saglanmaz ve sinav
-- sonuclanmazdi. Yeni kural: VAR OLAN cevaplarin tamami onaylanmissa sinav
-- sonuclanir; cevabi olmayan soru 0 puan sayilir.
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
  question_count   integer;
  submitted_count  integer;
  approved_count   integer;
  earned           numeric(8,2);
  total            numeric(8,2);
begin
  if not (public.is_admin() or public.can_review_exam(target_exam)) then
    raise exception 'Bu sonucu hesaplama yetkiniz yok.' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(points), 0)
  into question_count, total
  from public.exam_questions
  where exam_id = target_exam;

  -- Ogrencinin bu sinavda kac cevabi var, kaci onayli?
  select
    count(*),
    count(*) filter (
      where s.status = 'egitmen_onayli' and s.instructor_approved_score is not null
    )
  into submitted_count, approved_count
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
   and s.student_id = target_student
  where eq.exam_id = target_exam;

  -- Kazanilan puan yalnizca ONAYLI cevaplardan gelir; bos sorular 0.
  select coalesce(sum(eq.points * s.instructor_approved_score / 100.0), 0)
  into earned
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
   and s.student_id = target_student
  where eq.exam_id = target_exam
    and s.status = 'egitmen_onayli'
    and s.instructor_approved_score is not null;

  -- Cevaplarin tamami karara baglanmadan sonuc aciklanmaz. Hic cevap yoksa
  -- (ogrenci her soruyu bos birakmis) sinav dogrudan sonuclanir: 0 puan.
  if question_count = 0 or total <= 0 then
    return false;
  end if;

  if submitted_count > 0 and approved_count < submitted_count then
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

-- 3. Kontrol ---------------------------------------------------------------
-- Bos birakilmis bir sinav teslim edilebilmeli:
--   select public.submit_exam_attempt('<sinav-id>');
