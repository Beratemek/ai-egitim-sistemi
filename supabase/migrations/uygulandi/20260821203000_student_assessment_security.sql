-- Ogrenci degerlendirme verisinin sinav tamamen sonuclanmadan sizmasini
-- engeller. Bu migration uygulanmadan once sunucuya SUPABASE_SERVICE_ROLE_KEY
-- eklenmelidir; AI puanlama yazmalari artik yalnizca guvenli sunucu istemcisiyle
-- yapilir.

begin;

-- Ogrenci kendi cevap metnini her zaman gorebilir. AI puani, rubrik kirilimi,
-- egitmen notu ve nihai durum ise ancak exam_attempts.sonuclandi oldugunda acilir.
create or replace function public.get_my_submissions(target_exam uuid default null)
returns table (
  id uuid,
  exam_id uuid,
  question_id uuid,
  student_id uuid,
  answer_text text,
  ai_score numeric,
  ai_feedback text,
  ai_criteria_json jsonb,
  instructor_approved_score numeric,
  instructor_note text,
  status public.submission_status,
  reviewed_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.exam_id,
    s.question_id,
    s.student_id,
    s.answer_text,
    case when a.status = 'sonuclandi' then s.ai_score else null end,
    case when a.status = 'sonuclandi' then s.ai_feedback else null end,
    case when a.status = 'sonuclandi' then s.ai_criteria_json else '[]'::jsonb end,
    case when a.status = 'sonuclandi' then s.instructor_approved_score else null end,
    case when a.status = 'sonuclandi' then s.instructor_note else null end,
    case
      when a.status = 'sonuclandi' then s.status
      when s.status = 'gonderildi' then 'gonderildi'::public.submission_status
      else 'ai_degerlendirildi'::public.submission_status
    end,
    case when a.status = 'sonuclandi' then s.reviewed_by else null end,
    s.created_at,
    s.updated_at
  from public.submissions s
  left join public.exam_attempts a
    on a.exam_id = s.exam_id and a.student_id = s.student_id
  where s.student_id = auth.uid()
    and (target_exam is null or s.exam_id = target_exam)
  order by s.created_at desc;
$$;

revoke all on function public.get_my_submissions(uuid) from public;
grant execute on function public.get_my_submissions(uuid) to authenticated;

-- RLS tek basina UPDATE sirasinda kolon bazli degisikligi kisitlamaz. Bu
-- tetikleyici ogrencinin istemciden AI puani/status yazmasini, soruyu veya
-- ogrenciyi degistirmesini ve kapali bir attempt'a cevap eklemesini engeller.
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
      and (
        coalesce(assignment.due_at, exam.ends_at) is null
        or coalesce(assignment.due_at, exam.ends_at) >= now()
      )
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

drop trigger if exists submissions_guard_student_write on public.submissions;
create trigger submissions_guard_student_write
  before insert or update on public.submissions
  for each row execute function public.guard_student_submission_write();

-- Dogru cevap ve rubrik kolonlari tablo REST istegiyle okunamaz. Ogrenci sinav
-- sorularini yalnizca get_student_exam_questions() guvenli RPC'sinden alir.
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select using (
    public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
  );

-- Ham submission satiri ara onaylari ve AI geribildirimini sizdirir. Ogrenci
-- icin tek okuma kapisi yukaridaki alanlari maskeleyen RPC'dir.
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

commit;
