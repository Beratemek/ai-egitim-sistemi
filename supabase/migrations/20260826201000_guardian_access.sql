-- Veli -> ogrenci baglantisi ve veliye acilan dar, salt-okunur rapor kapilari.
--
-- Guvenlik ilkesi:
--   * Bir ogrencinin en fazla bir velisi olabilir (student_id PK).
--   * Bir veli birden fazla ogrenciye baglanabilir (guardian_id yalniz indeks).
--   * Baglantiyi yalnizca sistem yoneticisi yazar.
--   * Veli mevcut ham users/exams/submissions/questions/outcomes politikalarina
--     EKLENMEZ; yalnizca asagidaki sinirli SECURITY DEFINER RPC'leri kullanir.

begin;

create table if not exists public.guardian_student_links (
  student_id uuid primary key
    references public.users (id) on delete cascade,
  guardian_id uuid not null
    references public.users (id) on delete cascade,
  linked_by uuid
    references public.users (id) on delete set null,
  linked_at timestamptz not null default now(),
  constraint guardian_student_links_distinct_users
    check (student_id <> guardian_id)
);

comment on table public.guardian_student_links is
  'Bir ogrenciyi tek bir veli hesabina baglar. Bir veli birden fazla ogrenciye baglanabilir.';
comment on column public.guardian_student_links.student_id is
  'Primary key oldugu icin bir ogrencinin ayni anda en fazla bir velisi olabilir.';
comment on column public.guardian_student_links.guardian_id is
  'Veli rolu verilmis kullanici. Unique degildir; ayni veli birden fazla ogrenciye baglanabilir.';

create index if not exists guardian_student_links_guardian_idx
  on public.guardian_student_links (guardian_id, linked_at desc);

alter table public.guardian_student_links enable row level security;

drop policy if exists "guardian_links_select" on public.guardian_student_links;
create policy "guardian_links_select" on public.guardian_student_links
  for select using (public.is_admin());

drop policy if exists "guardian_links_insert_admin" on public.guardian_student_links;
create policy "guardian_links_insert_admin" on public.guardian_student_links
  for insert with check (public.is_admin());

drop policy if exists "guardian_links_update_admin" on public.guardian_student_links;
create policy "guardian_links_update_admin" on public.guardian_student_links
  for update using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "guardian_links_delete_admin" on public.guardian_student_links;
create policy "guardian_links_delete_admin" on public.guardian_student_links
  for delete using (public.is_admin());

revoke all on table public.guardian_student_links from public, anon, authenticated;
grant select on table public.guardian_student_links to authenticated;

-- RLS mesru aktoru sinirlar; bu tetikleyici ise service_role/dogrudan SQL
-- dahil her yazma yolunda iki ucun de dogru ve onayli rolde kalmasini saglar.
create or replace function public.validate_guardian_student_link()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.student_id = new.guardian_id then
    raise exception 'Bir kullanici kendi velisi olarak atanamaz.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users student
    where student.id = new.student_id
      and student.role_status = 'onayli'
      and (
        'ogrenci' = any(student.roles)
        or (coalesce(cardinality(student.roles), 0) = 0 and student.role = 'ogrenci')
      )
  ) then
    raise exception 'Secilen kullanici onayli bir ogrenci degil.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users guardian
    where guardian.id = new.guardian_id
      and guardian.role_status = 'onayli'
      and (
        'veli' = any(guardian.roles)
        or (coalesce(cardinality(guardian.roles), 0) = 0 and guardian.role = 'veli')
      )
  ) then
    raise exception 'Secilen kullanici onayli bir veli degil.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists guardian_student_links_validate
  on public.guardian_student_links;
create trigger guardian_student_links_validate
  before insert or update on public.guardian_student_links
  for each row execute function public.validate_guardian_student_link();

revoke all on function public.validate_guardian_student_link() from public;

-- Rol veya genel onay kaybedildiginde eski baglantinin yetki vermeye devam
-- etmemesi gerekir. Hesap silme ise iki foreign key'in ON DELETE CASCADE'iyle
-- ayni sonucu verir.
create or replace function public.cleanup_guardian_links_after_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remains_student boolean;
  remains_guardian boolean;
begin
  remains_student :=
    new.role_status = 'onayli'
    and (
      'ogrenci' = any(new.roles)
      or (coalesce(cardinality(new.roles), 0) = 0 and new.role = 'ogrenci')
    );

  remains_guardian :=
    new.role_status = 'onayli'
    and (
      'veli' = any(new.roles)
      or (coalesce(cardinality(new.roles), 0) = 0 and new.role = 'veli')
    );

  if not remains_student then
    delete from public.guardian_student_links link
    where link.student_id = new.id;
  end if;

  if not remains_guardian then
    delete from public.guardian_student_links link
    where link.guardian_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists users_cleanup_guardian_links on public.users;
create trigger users_cleanup_guardian_links
  after update of role, roles, role_status on public.users
  for each row execute function public.cleanup_guardian_links_after_role_change();

revoke all on function public.cleanup_guardian_links_after_role_change()
  from public;

-- Tek resmi yazma kapisi. Ogrenci profil satiri FOR UPDATE ile kilitlenir;
-- iki yonetici ayni anda farkli veli atasa bile son durum tutarli ve tekildir.
-- target_guardian = null baglantiyi kaldirir.
create or replace function public.set_student_guardian(
  target_student uuid,
  target_guardian uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Veli atamasi yalnizca sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  -- Var olan baglanti satiri olmasa da ogrenci satirini kilitlemek, ayni
  -- ogrenci icin paralel atamalari siraya sokar.
  perform 1
  from public.users student
  where student.id = target_student
  for update;

  if not found then
    raise exception 'Ogrenci bulunamadi.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users student
    where student.id = target_student
      and student.role_status = 'onayli'
      and (
        'ogrenci' = any(student.roles)
        or (coalesce(cardinality(student.roles), 0) = 0 and student.role = 'ogrenci')
      )
  ) then
    raise exception 'Secilen kullanici onayli bir ogrenci degil.'
      using errcode = '22023';
  end if;

  if target_guardian is null then
    delete from public.guardian_student_links link
    where link.student_id = target_student;
    return null;
  end if;

  if target_student = target_guardian then
    raise exception 'Bir kullanici kendi velisi olarak atanamaz.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users guardian
    where guardian.id = target_guardian
      and guardian.role_status = 'onayli'
      and (
        'veli' = any(guardian.roles)
        or (coalesce(cardinality(guardian.roles), 0) = 0 and guardian.role = 'veli')
      )
  ) then
    raise exception 'Secilen kullanici onayli bir veli degil.'
      using errcode = '22023';
  end if;

  insert into public.guardian_student_links (
    student_id,
    guardian_id,
    linked_by,
    linked_at
  )
  values (target_student, target_guardian, auth.uid(), now())
  on conflict (student_id) do update
  set guardian_id = excluded.guardian_id,
      linked_by = excluded.linked_by,
      linked_at = excluded.linked_at;

  return target_guardian;
end;
$$;

revoke all on function public.set_student_guardian(uuid, uuid) from public;
grant execute on function public.set_student_guardian(uuid, uuid) to authenticated;

-- Veli ana ekrani: yalnizca bagli cocuk kimligi ve toplu ilerleme sayilari.
-- E-posta, cevap, soru, rubrik ve ara AI degerlendirmesi donmez.
create or replace function public.get_guardian_students()
returns table (
  guardian_id uuid,
  guardian_name text,
  student_id uuid,
  student_name text,
  classroom text,
  assigned_exam_count bigint,
  completed_exam_count bigint,
  overdue_exam_count bigint,
  average_score numeric,
  latest_score numeric,
  latest_completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean;
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  actor_is_admin := public.is_admin();
  if not actor_is_admin and not public.has_role('veli') then
    raise exception 'Bu raporu goruntuleme yetkiniz yok.' using errcode = '42501';
  end if;

  return query
  select
    link.guardian_id,
    coalesce(nullif(btrim(guardian.full_name), ''), 'Veli') as guardian_name,
    link.student_id,
    coalesce(nullif(btrim(student.full_name), ''), 'Isimsiz ogrenci') as student_name,
    student.classroom,
    metrics.assigned_exam_count,
    metrics.completed_exam_count,
    metrics.overdue_exam_count,
    metrics.average_score,
    latest.final_score as latest_score,
    latest.completed_at as latest_completed_at
  from public.guardian_student_links link
  join public.users guardian on guardian.id = link.guardian_id
  join public.users student on student.id = link.student_id
  left join lateral (
    select
      count(*)::bigint as assigned_exam_count,
      count(*) filter (where attempt.status = 'sonuclandi')
        as completed_exam_count,
      count(*) filter (
        where coalesce(assignment.due_at, exam.ends_at) < now()
          and (attempt.id is null or attempt.status = 'devam_ediyor')
      ) as overdue_exam_count,
      round(
        avg(attempt.final_score) filter (
          where attempt.status = 'sonuclandi'
            and attempt.final_score is not null
        ),
        2
      ) as average_score
    from public.exam_assignments assignment
    join public.exams exam on exam.id = assignment.exam_id
    left join public.exam_attempts attempt
      on attempt.exam_id = assignment.exam_id
     and attempt.student_id = assignment.student_id
    where assignment.student_id = link.student_id
      and (exam.is_published or attempt.status = 'sonuclandi')
  ) metrics on true
  left join lateral (
    select attempt.final_score, attempt.completed_at
    from public.exam_attempts attempt
    where attempt.student_id = link.student_id
      and attempt.status = 'sonuclandi'
      and attempt.final_score is not null
    order by attempt.completed_at desc nulls last, attempt.updated_at desc
    limit 1
  ) latest on true
  where actor_is_admin or link.guardian_id = actor
  order by student.full_name, link.student_id;
end;
$$;

revoke all on function public.get_guardian_students() from public;
grant execute on function public.get_guardian_students() to authenticated;

-- Bagli ogrencinin sinav ilerlemesi. Final puan yalnizca sonuc tamamlandiginda
-- doner; devam eden/degerlendirilen sinavin ara puani acilmaz.
create or replace function public.get_guardian_student_exams(target_student uuid)
returns table (
  exam_id uuid,
  title text,
  subject text,
  due_at timestamptz,
  progress_status text,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  final_score numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  if not public.is_admin() and not (
    public.has_role('veli')
    and exists (
      select 1
      from public.guardian_student_links link
      where link.student_id = target_student
        and link.guardian_id = actor
    )
  ) then
    raise exception 'Bu ogrencinin raporunu goruntuleme yetkiniz yok.'
      using errcode = '42501';
  end if;

  return query
  select
    exam.id as exam_id,
    exam.title,
    coalesce(exam.subject, 'Ders belirtilmemis') as subject,
    coalesce(assignment.due_at, exam.ends_at) as due_at,
    case
      when attempt.id is null then 'baslanmadi'
      else attempt.status::text
    end as progress_status,
    attempt.started_at,
    attempt.submitted_at,
    attempt.completed_at,
    case
      when attempt.status = 'sonuclandi' then attempt.final_score
      else null
    end as final_score
  from public.exam_assignments assignment
  join public.exams exam on exam.id = assignment.exam_id
  left join public.exam_attempts attempt
    on attempt.exam_id = assignment.exam_id
   and attempt.student_id = assignment.student_id
  where assignment.student_id = target_student
    and (exam.is_published or attempt.status = 'sonuclandi')
  order by
    coalesce(attempt.completed_at, attempt.submitted_at, attempt.started_at,
             assignment.assigned_at) desc;
end;
$$;

revoke all on function public.get_guardian_student_exams(uuid) from public;
grant execute on function public.get_guardian_student_exams(uuid) to authenticated;

-- Kazanim ozetinde yalnizca SONUCLANMIS deneme + EGITMEN ONAYLI puan
-- kanittir. Fonksiyon soru metni, cevap metni, dogru cevap, rubrik, AI notu
-- veya kazanimin source_text alanini secmez/dondurmez.
create or replace function public.get_guardian_student_outcomes(target_student uuid)
returns table (
  outcome_id uuid,
  outcome_text text,
  subject text,
  topic text,
  average_score numeric,
  approved_answer_count bigint,
  measured_question_count bigint,
  exam_count bigint,
  evidence_level text,
  is_actionable_weak boolean,
  latest_evidence_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  if not public.is_admin() and not (
    public.has_role('veli')
    and exists (
      select 1
      from public.guardian_student_links link
      where link.student_id = target_student
        and link.guardian_id = actor
    )
  ) then
    raise exception 'Bu ogrencinin raporunu goruntuleme yetkiniz yok.'
      using errcode = '42501';
  end if;

  return query
  with eligible_evidence as (
    select
      question.outcome_id,
      submission.exam_id,
      submission.question_id,
      submission.instructor_approved_score as approved_score,
      exam_question.points as points,
      submission.updated_at as evidence_at,
      question.subject as question_subject
    from public.exam_attempts attempt
    join public.submissions submission
      on submission.exam_id = attempt.exam_id
     and submission.student_id = attempt.student_id
    join public.exam_questions exam_question
      on exam_question.exam_id = submission.exam_id
     and exam_question.question_id = submission.question_id
    join public.questions question on question.id = submission.question_id
    where attempt.student_id = target_student
      and attempt.status = 'sonuclandi'
      and submission.status = 'egitmen_onayli'
      and submission.instructor_approved_score is not null
      and question.outcome_id is not null
  ),
  aggregated as (
    select
      outcome.id as outcome_id,
      outcome.outcome_text,
      coalesce(outcome.subject, max(evidence.question_subject), 'Ders belirtilmemis')
        as subject,
      outcome.topic,
      round(
        sum(evidence.approved_score * evidence.points)
          / nullif(sum(evidence.points), 0),
        1
      ) as average_score,
      count(*)::bigint as approved_answer_count,
      count(distinct evidence.question_id)::bigint as measured_question_count,
      count(distinct evidence.exam_id)::bigint as exam_count,
      max(evidence.evidence_at) as latest_evidence_at
    from eligible_evidence evidence
    join public.learning_outcomes outcome on outcome.id = evidence.outcome_id
    group by outcome.id, outcome.outcome_text, outcome.subject, outcome.topic
  )
  select
    aggregated.outcome_id,
    aggregated.outcome_text,
    aggregated.subject,
    aggregated.topic,
    aggregated.average_score,
    aggregated.approved_answer_count,
    aggregated.measured_question_count,
    aggregated.exam_count,
    case
      when aggregated.measured_question_count < 2 then 'early'
      when aggregated.exam_count < 2 then 'supported'
      else 'strong'
    end as evidence_level,
    (
      aggregated.average_score < 60
      and aggregated.measured_question_count >= 2
    ) as is_actionable_weak,
    aggregated.latest_evidence_at
  from aggregated
  order by aggregated.average_score, aggregated.outcome_text;
end;
$$;

revoke all on function public.get_guardian_student_outcomes(uuid) from public;
grant execute on function public.get_guardian_student_outcomes(uuid) to authenticated;

-- Rol secme ekrani ilk katilim / reddedilen talebi yenileme akisidir; onayli
-- bir kullanicinin kendi kendine ek rol almasi icin kullanilmaz. Ek roller
-- sistem yoneticisinin `set_user_roles` kapisindan verilir. Bu kosul ayni
-- zamanda gercek bir ogrencinin /hosgeldiniz yolunu elle acip teknik
-- ['ogrenci'] kumesini veli onayinda kaybetmesini engeller.
create or replace function public.request_role(target public.user_role)
returns public.role_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  if target is null then
    raise exception 'Bir rol secmeniz gerekiyor.' using errcode = '22023';
  end if;

  if target = 'admin' then
    raise exception 'Sistem yoneticisi rolu kullanici tarafindan talep edilemez.'
      using errcode = '42501';
  end if;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = 'ogrenci',
      requested_role   = target,
      role_status      = 'beklemede',
      role_reviewed_by = null,
      role_reviewed_at = null,
      updated_at       = now()
  where id = auth.uid()
    and role_status in ('secilmedi', 'reddedildi');

  if not found then
    raise exception 'Onayli hesaplarda ek rol talebi sistem yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  perform set_config('app.role_change_allowed', 'off', true);

  return 'beklemede';
end;
$$;

revoke all on function public.request_role(public.user_role) from public;
grant execute on function public.request_role(public.user_role) to authenticated;

-- Yeni hesaplar onay beklerken guvenli bootstrap olarak ['ogrenci'] tasir.
-- Talep edilen rol veli ise bu teknik bootstrap rolunu korumak, veliyi
-- analitiklerde ogrenci gibi sayar ve ona ogrenci akislari acardi. Yalnizca
-- tam bootstrap kumesinde veliyle yer degistir; gercek coklu rol kumelerine
-- dokunma.
create or replace function public.review_role_request(
  target_user uuid,
  approve boolean
)
returns public.role_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not public.is_admin() then
    raise exception 'Rol talepleri yalnizca sistem yoneticisi tarafindan karara baglanir.'
      using errcode = '42501';
  end if;

  if approve is null then
    raise exception 'Onay karari bos birakilamaz.' using errcode = '22023';
  end if;

  select requested_role into wanted
  from public.users
  where id = target_user
    and role_status = 'beklemede'
  for update;

  if not found or wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.'
      using errcode = '22023';
  end if;

  result := case when approve then 'onayli' else 'reddedildi' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set roles = case
        when not approve then roles
        when wanted = 'veli'
             and (
               roles = array['ogrenci']::public.user_role[]
               or coalesce(cardinality(roles), 0) = 0
             )
          then array['veli']::public.user_role[]
        else array[wanted]::public.user_role[] || array_remove(roles, wanted)
      end,
      role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

revoke all on function public.review_role_request(uuid, boolean) from public;
grant execute on function public.review_role_request(uuid, boolean)
  to authenticated;

commit;
