-- Tamamlanan sinav baglamindan istege bagli, anonim ders deneyimi
-- degerlendirmesi toplar. Ham kayitlari yalnizca ogrencinin kendisi gorebilir;
-- egitmen ve egitim yoneticisi en az 3 yanitlik toplu ozet alir.

begin;

create table if not exists public.course_experience_feedback (
  id                          uuid primary key default gen_random_uuid(),
  student_id                  uuid not null references public.users (id) on delete cascade,
  source_exam_id              uuid not null references public.exams (id) on delete cascade,
  instructor_id               uuid not null references public.users (id) on delete cascade,
  subject                     text not null,
  subject_key                 text not null,
  academic_period             text not null,
  clarity_rating              smallint not null check (clarity_rating between 1 and 5),
  pace_rating                 smallint not null check (pace_rating between 1 and 5),
  materials_rating            smallint not null check (materials_rating between 1 and 5),
  assessment_fairness_rating  smallint not null check (assessment_fairness_rating between 1 and 5),
  helpful_text                text check (char_length(helpful_text) <= 1500),
  improvement_text            text check (char_length(improvement_text) <= 1500),
  anonymous                   boolean not null default true check (anonymous),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint course_feedback_one_per_period unique (
    student_id,
    instructor_id,
    subject_key,
    academic_period
  )
);

create index if not exists course_feedback_instructor_period_idx
  on public.course_experience_feedback (
    instructor_id,
    academic_period,
    subject_key
  );

drop trigger if exists course_feedback_set_updated_at
  on public.course_experience_feedback;
create trigger course_feedback_set_updated_at
  before update on public.course_experience_feedback
  for each row execute function public.set_updated_at();

alter table public.course_experience_feedback enable row level security;

drop policy if exists "course_feedback_select_own"
  on public.course_experience_feedback;
create policy "course_feedback_select_own"
  on public.course_experience_feedback
  for select
  using (student_id = auth.uid());

-- Ogrenci ham tabloya dogrudan yazamaz. Asagidaki RPC tamamlanmis sinavi,
-- ders/egitmen bagini ve puan araliklarini sunucu tarafinda dogrular.
revoke insert, update, delete on public.course_experience_feedback
  from authenticated;
grant select on public.course_experience_feedback to authenticated;

create or replace function public.submit_course_experience_feedback(
  target_exam uuid,
  clarity smallint,
  pace smallint,
  materials smallint,
  assessment_fairness smallint,
  helpful text default null,
  improvement text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target_instructor uuid;
  target_subject text;
  target_subject_key text;
  target_period text;
  completed_time timestamptz;
  feedback_id uuid;
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  if not public.has_role('ogrenci') then
    raise exception 'Yalnizca ogrenciler ders deneyimi degerlendirebilir.'
      using errcode = '42501';
  end if;

  if clarity not between 1 and 5
     or pace not between 1 and 5
     or materials not between 1 and 5
     or assessment_fairness not between 1 and 5
  then
    raise exception 'Tum puanlar 1 ile 5 arasinda olmalidir.';
  end if;

  select
    exam.instructor_id,
    coalesce(nullif(btrim(exam.subject), ''), 'Ders belirtilmemis'),
    attempt.completed_at
  into target_instructor, target_subject, completed_time
  from public.exam_attempts attempt
  join public.exams exam on exam.id = attempt.exam_id
  where attempt.exam_id = target_exam
    and attempt.student_id = actor
    and attempt.status = 'sonuclandi'
    and attempt.completed_at is not null;

  if target_instructor is null or completed_time is null then
    raise exception 'Yalnizca tamamlanmis bir sinavin ders deneyimi degerlendirilebilir.';
  end if;

  target_subject_key := lower(target_subject);
  target_period :=
    extract(year from timezone('Europe/Istanbul', completed_time))::integer::text
    || '-'
    || case
      when extract(month from timezone('Europe/Istanbul', completed_time)) <= 6
        then '1'
      else '2'
    end;

  insert into public.course_experience_feedback (
    student_id,
    source_exam_id,
    instructor_id,
    subject,
    subject_key,
    academic_period,
    clarity_rating,
    pace_rating,
    materials_rating,
    assessment_fairness_rating,
    helpful_text,
    improvement_text,
    anonymous
  ) values (
    actor,
    target_exam,
    target_instructor,
    target_subject,
    target_subject_key,
    target_period,
    clarity,
    pace,
    materials,
    assessment_fairness,
    nullif(btrim(helpful), ''),
    nullif(btrim(improvement), ''),
    true
  )
  on conflict (student_id, instructor_id, subject_key, academic_period)
  do update set
    source_exam_id = excluded.source_exam_id,
    clarity_rating = excluded.clarity_rating,
    pace_rating = excluded.pace_rating,
    materials_rating = excluded.materials_rating,
    assessment_fairness_rating = excluded.assessment_fairness_rating,
    helpful_text = excluded.helpful_text,
    improvement_text = excluded.improvement_text,
    anonymous = true
  returning id into feedback_id;

  return feedback_id;
end;
$$;

revoke all on function public.submit_course_experience_feedback(
  uuid, smallint, smallint, smallint, smallint, text, text
) from public;
grant execute on function public.submit_course_experience_feedback(
  uuid, smallint, smallint, smallint, smallint, text, text
) to authenticated;

create or replace function public.get_course_experience_feedback_summary()
returns table (
  instructor_id uuid,
  instructor_name text,
  subject text,
  academic_period text,
  response_count bigint,
  clarity_average numeric,
  pace_average numeric,
  materials_average numeric,
  assessment_fairness_average numeric,
  overall_average numeric,
  helpful_comments jsonb,
  improvement_comments jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  can_view_all boolean;
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  can_view_all := public.has_role('egitim_yoneticisi');
  if not can_view_all and not public.has_role('egitmen') then
    raise exception 'Ders deneyimi ozetlerini goruntuleme yetkiniz yok.'
      using errcode = '42501';
  end if;

  return query
  select
    feedback.instructor_id,
    coalesce(nullif(profile.full_name, ''), 'Egitmen') as instructor_name,
    max(feedback.subject) as subject,
    feedback.academic_period,
    count(*) as response_count,
    case when count(*) >= 3 then round(avg(feedback.clarity_rating), 2) end,
    case when count(*) >= 3 then round(avg(feedback.pace_rating), 2) end,
    case when count(*) >= 3 then round(avg(feedback.materials_rating), 2) end,
    case when count(*) >= 3 then round(avg(feedback.assessment_fairness_rating), 2) end,
    case when count(*) >= 3 then round(avg(
      (feedback.clarity_rating + feedback.pace_rating +
       feedback.materials_rating + feedback.assessment_fairness_rating) / 4.0
    ), 2) end,
    case when count(*) >= 3 then coalesce(
      jsonb_agg(feedback.helpful_text)
        filter (where feedback.helpful_text is not null),
      '[]'::jsonb
    ) else '[]'::jsonb end,
    case when count(*) >= 3 then coalesce(
      jsonb_agg(feedback.improvement_text)
        filter (where feedback.improvement_text is not null),
      '[]'::jsonb
    ) else '[]'::jsonb end
  from public.course_experience_feedback feedback
  join public.users profile on profile.id = feedback.instructor_id
  where can_view_all or feedback.instructor_id = actor
  group by
    feedback.instructor_id,
    profile.full_name,
    feedback.subject_key,
    feedback.academic_period
  order by feedback.academic_period desc, max(feedback.subject), profile.full_name;
end;
$$;

revoke all on function public.get_course_experience_feedback_summary() from public;
grant execute on function public.get_course_experience_feedback_summary()
  to authenticated;

commit;
