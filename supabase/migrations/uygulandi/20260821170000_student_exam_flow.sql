-- Ogrenci sinav atama, oturum ve nihai puan modeli.
-- Idempotent olacak sekilde yazilmistir; mevcut yayinlanmis sinav/cevaplari
-- yeni modele geriye uyumlu olarak tasir.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'exam_attempt_status' and n.nspname = 'public'
  ) then
    create type public.exam_attempt_status as enum (
      'devam_ediyor',
      'degerlendiriliyor',
      'sonuclandi'
    );
  end if;
end
$$;

alter table public.submissions
  add column if not exists ai_criteria_json jsonb not null default '[]'::jsonb;

create table if not exists public.exam_assignments (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams (id) on delete cascade,
  student_id  uuid not null references public.users (id) on delete cascade,
  assigned_by uuid references public.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at      timestamptz,
  unique (exam_id, student_id)
);

create table if not exists public.exam_attempts (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  student_id     uuid not null references public.users (id) on delete cascade,
  status         public.exam_attempt_status not null default 'devam_ediyor',
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  completed_at   timestamptz,
  earned_points  numeric(8,2),
  total_points   numeric(8,2),
  final_score    numeric(5,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (exam_id, student_id),
  constraint exam_attempt_final_score_range check (
    final_score is null or (final_score >= 0 and final_score <= 100)
  ),
  constraint exam_attempt_result_consistency check (
    status <> 'sonuclandi'
    or (
      submitted_at is not null
      and completed_at is not null
      and final_score is not null
      and earned_points is not null
      and total_points is not null
    )
  )
);

create index if not exists exam_assignments_student_idx
  on public.exam_assignments (student_id, assigned_at desc);
create index if not exists exam_attempts_student_idx
  on public.exam_attempts (student_id, updated_at desc);
create index if not exists exam_attempts_exam_idx
  on public.exam_attempts (exam_id, status);

drop trigger if exists exam_attempts_set_updated_at on public.exam_attempts;
create trigger exam_attempts_set_updated_at
  before update on public.exam_attempts
  for each row execute function public.set_updated_at();

alter table public.exam_assignments enable row level security;
alter table public.exam_attempts enable row level security;

create or replace function public.is_exam_assigned_to_current_user(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.exam_assignments a
    where a.exam_id = target_exam and a.student_id = auth.uid()
  );
$$;

create or replace function public.can_manage_exam(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  );
$$;

revoke all on function public.is_exam_assigned_to_current_user(uuid) from public;
revoke all on function public.can_manage_exam(uuid) from public;
grant execute on function public.is_exam_assigned_to_current_user(uuid) to authenticated;
grant execute on function public.can_manage_exam(uuid) to authenticated;


drop policy if exists "exam_assignments_select" on public.exam_assignments;
create policy "exam_assignments_select" on public.exam_assignments
  for select using (
    student_id = auth.uid()
    or public.can_manage_exam(exam_id)
  );

drop policy if exists "exam_assignments_write" on public.exam_assignments;
create policy "exam_assignments_write" on public.exam_assignments
  for all using (
    public.can_manage_exam(exam_id)
  )
  with check (
    public.can_manage_exam(exam_id)
  );

drop policy if exists "exam_attempts_select" on public.exam_attempts;
create policy "exam_attempts_select" on public.exam_attempts
  for select using (
    student_id = auth.uid()
    or public.can_manage_exam(exam_id)
  );

-- Ogrenci attempt satirini dogrudan degistiremez. Durum gecisleri asagidaki
-- security-definer fonksiyonlardan yapilir; nihai puani istemciden yazamaz.

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
  evaluated_count integer;
begin
  if actor is null then raise exception 'Oturum acmaniz gerekiyor.'; end if;

  select count(*) into question_count
  from public.exam_questions
  where exam_id = target_exam;

  select count(*) into evaluated_count
  from public.submissions
  where exam_id = target_exam
    and student_id = actor
    and question_id is not null
    and status in ('ai_degerlendirildi', 'egitmen_onayli');

  if question_count = 0 or evaluated_count < question_count then
    raise exception 'Tum cevaplar degerlendirmeye gonderilmeden sinav teslim edilemez.';
  end if;

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
  if not (
    public.has_role('egitim_yoneticisi')
    or exists (
      select 1 from public.exams e
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  ) then
    raise exception 'Bu sonucu hesaplama yetkiniz yok.';
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

revoke all on function public.start_exam_attempt(uuid) from public;
revoke all on function public.submit_exam_attempt(uuid) from public;
revoke all on function public.recalculate_exam_attempt_result(uuid, uuid) from public;
grant execute on function public.start_exam_attempt(uuid) to authenticated;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
grant execute on function public.recalculate_exam_attempt_result(uuid, uuid) to authenticated;

-- Mevcut MVP verisini kaybetmeden yeni modele gecis: yayinlanmis sinavlar
-- mevcut ogrencilere atanir, cevabi olan ogrenciler icin attempt olusturulur.
insert into public.exam_assignments (exam_id, student_id, assigned_by, due_at)
select e.id, u.id, e.instructor_id, e.ends_at
from public.exams e
cross join public.users u
where e.is_published and u.role = 'ogrenci'
on conflict (exam_id, student_id) do nothing;

insert into public.exam_attempts (
  exam_id,
  student_id,
  status,
  started_at,
  submitted_at
)
select
  s.exam_id,
  s.student_id,
  case
    when count(*) filter (where s.status <> 'gonderildi') >=
         (select count(*) from public.exam_questions eq where eq.exam_id = s.exam_id)
      then 'degerlendiriliyor'::public.exam_attempt_status
    else 'devam_ediyor'::public.exam_attempt_status
  end,
  min(s.created_at),
  case
    when count(*) filter (where s.status <> 'gonderildi') >=
         (select count(*) from public.exam_questions eq where eq.exam_id = s.exam_id)
      then max(s.updated_at)
    else null
  end
from public.submissions s
group by s.exam_id, s.student_id
on conflict (exam_id, student_id) do nothing;

-- Daha once tum cevaplari onaylanmis sinavlarin agirlikli nihai sonucunu da tasir.
with existing_results as (
  select
    eq.exam_id,
    s.student_id,
    count(*) as approved_count,
    (select count(*) from public.exam_questions all_eq where all_eq.exam_id = eq.exam_id)
      as question_count,
    sum(eq.points * s.instructor_approved_score / 100.0) as earned,
    sum(eq.points) as total
  from public.exam_questions eq
  join public.submissions s
    on s.exam_id = eq.exam_id
   and s.question_id = eq.question_id
  where s.status = 'egitmen_onayli'
    and s.instructor_approved_score is not null
  group by eq.exam_id, s.student_id
)
update public.exam_attempts a
set
  status = 'sonuclandi',
  submitted_at = coalesce(a.submitted_at, a.updated_at),
  completed_at = coalesce(a.completed_at, a.updated_at),
  earned_points = round(r.earned, 2),
  total_points = round(r.total, 2),
  final_score = round(r.earned / r.total * 100.0, 2)
from existing_results r
where a.exam_id = r.exam_id
  and a.student_id = r.student_id
  and r.question_count > 0
  and r.approved_count >= r.question_count
  and r.total > 0;
create or replace function public.get_student_exam_questions(target_exam uuid)
returns table (
  id uuid,
  subject text,
  topic text,
  text text,
  type public.question_type,
  options_json jsonb,
  outcome_id uuid,
  "position" integer,
  points numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.subject,
    q.topic,
    q.text,
    q.type,
    q.options_json,
    q.outcome_id,
    eq.position as "position",
    eq.points
  from public.exam_assignments a
  join public.exam_attempts attempt
    on attempt.exam_id = a.exam_id
   and attempt.student_id = a.student_id
  join public.exam_questions eq on eq.exam_id = a.exam_id
  join public.questions q on q.id = eq.question_id
  where a.exam_id = target_exam
    and a.student_id = auth.uid()
    and q.status = 'onayli'
  order by eq.position;
$$;

revoke all on function public.get_student_exam_questions(uuid) from public;
grant execute on function public.get_student_exam_questions(uuid) to authenticated;

-- Ogrenci yalnizca kendisine atanmis yayinlanmis sinavlari ve baglarini gorur.
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    instructor_id = auth.uid()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (
      is_published
      and public.is_exam_assigned_to_current_user(exams.id)
    )
  );

drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    public.can_manage_exam(exam_id)
    or public.has_role('icerik_uzmani')
    or public.is_exam_assigned_to_current_user(exam_id)
  );

commit;
