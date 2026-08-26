-- Ogrencinin calisma planini tarayicidan Supabase hesabina tasir.
-- Her kullanici yalnizca kendi plan maddelerini okuyabilir ve degistirebilir.

begin;

create table if not exists public.student_study_plan_items (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.users (id) on delete cascade,
  recommendation_key text not null,
  title              text not null,
  context            text,
  action             text,
  evidence           text,
  outcome_id         uuid,
  latest_exam_id     uuid,
  status             text not null default 'baslanmadi',
  saved_at           timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint student_study_plan_status_check check (
    status in ('baslanmadi', 'calisiliyor', 'tamamlandi')
  ),
  constraint student_study_plan_recommendation_unique unique (
    student_id,
    recommendation_key
  )
);

create index if not exists student_study_plan_student_updated_idx
  on public.student_study_plan_items (student_id, updated_at desc);

drop trigger if exists student_study_plan_set_updated_at
  on public.student_study_plan_items;
create trigger student_study_plan_set_updated_at
  before update on public.student_study_plan_items
  for each row execute function public.set_updated_at();

alter table public.student_study_plan_items enable row level security;

drop policy if exists "student_study_plan_select_own"
  on public.student_study_plan_items;
create policy "student_study_plan_select_own"
  on public.student_study_plan_items
  for select
  using (student_id = auth.uid());

drop policy if exists "student_study_plan_insert_own"
  on public.student_study_plan_items;
create policy "student_study_plan_insert_own"
  on public.student_study_plan_items
  for insert
  with check (student_id = auth.uid());

drop policy if exists "student_study_plan_update_own"
  on public.student_study_plan_items;
create policy "student_study_plan_update_own"
  on public.student_study_plan_items
  for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "student_study_plan_delete_own"
  on public.student_study_plan_items;
create policy "student_study_plan_delete_own"
  on public.student_study_plan_items
  for delete
  using (student_id = auth.uid());

grant select, insert, update, delete
  on public.student_study_plan_items to authenticated;

commit;
