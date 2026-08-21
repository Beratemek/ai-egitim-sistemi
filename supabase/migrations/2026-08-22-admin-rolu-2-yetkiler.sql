-- ---------------------------------------------------------------------------
-- ADIM 2/2 - `admin` rolune tam yetki
--
-- ONCE 1. adim dosyasini calistirin (enum'a 'admin' ekler), sonra bunu.
--
-- `admin` gizli bir sistem rolüdür: kayit ve rol secim ekranlarinda gorunmez,
-- yalnizca buradan atanir. Sitedeki her panele girer ve tum tablolarda okuma
-- ve yazma yetkisine sahiptir.
--
-- Idempotenttir, birden fazla calistirilabilir.
-- ---------------------------------------------------------------------------

-- 1. Yardimci: cagiran kullanici admin mi? -----------------------------------
-- role::text karsilastirmasi bilincli: enum literali kullanilmadigi icin bu
-- fonksiyon 1. adimin ayni oturumda calistirilip calistirilmadigindan
-- etkilenmez.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role::text = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 2. Sinav yonetimi yardimcisi -----------------------------------------------
create or replace function public.can_manage_exam(target_exam uuid)
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
      where e.id = target_exam and e.instructor_id = auth.uid()
    )
  );
$$;

-- 3. Rol talebi karara baglama: admin de onaylayabilsin ----------------------
create or replace function public.review_role_request(
  target_user uuid,
  approve boolean
)
returns public.role_status
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted public.user_role;
  result public.role_status;
begin
  if not (public.is_admin() or public.has_role('egitim_yoneticisi')) then
    raise exception 'Bu islem icin egitim yoneticisi olmaniz gerekiyor.'
      using errcode = '42501';
  end if;

  select requested_role into wanted from public.users where id = target_user;

  if wanted is null then
    raise exception 'Bu kullanicinin bekleyen bir rol talebi yok.'
      using errcode = '22023';
  end if;

  result := case when approve then 'onayli' else 'reddedildi' end;

  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
  set role             = case when approve then wanted else role end,
      role_status      = result,
      role_reviewed_by = auth.uid(),
      role_reviewed_at = now(),
      updated_at       = now()
  where id = target_user;

  perform set_config('app.role_change_allowed', 'off', true);

  return result;
end;
$$;

-- 4. RLS politikalari --------------------------------------------------------
-- Her politikaya `public.is_admin()` eklenir; mevcut kurallar korunur.

-- --- users -----------------------------------------------------------------
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select using (
    id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

-- --- learning_outcomes -----------------------------------------------------
drop policy if exists "outcomes_write_icerik_uzmani" on public.learning_outcomes;
create policy "outcomes_write_icerik_uzmani" on public.learning_outcomes
  for all using (public.is_admin() or public.has_role('icerik_uzmani'))
  with check (public.is_admin() or public.has_role('icerik_uzmani'));

-- --- questions -------------------------------------------------------------
drop policy if exists "questions_select" on public.questions;
create policy "questions_select" on public.questions
  for select using (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "questions_insert" on public.questions;
create policy "questions_insert" on public.questions
  for insert with check (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('icerik_uzmani')
  );

drop policy if exists "questions_update_egitmen" on public.questions;
drop policy if exists "questions_update" on public.questions;
create policy "questions_update" on public.questions
  for update using (
    public.is_admin()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitmen')
  )
  with check (
    public.is_admin()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitmen')
  );

drop policy if exists "questions_delete_egitmen" on public.questions;
create policy "questions_delete_egitmen" on public.questions
  for delete using (public.is_admin() or public.has_role('egitmen'));

-- --- exams -----------------------------------------------------------------
drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    public.is_admin()
    or instructor_id = auth.uid()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (
      is_published
      and public.is_exam_assigned_to_current_user(exams.id)
    )
  );

drop policy if exists "exams_write_egitmen" on public.exams;
create policy "exams_write_egitmen" on public.exams
  for all using (
    public.is_admin()
    or (public.has_role('egitmen') and instructor_id = auth.uid())
  )
  with check (
    public.is_admin()
    or (public.has_role('egitmen') and instructor_id = auth.uid())
  );

-- --- exam_questions --------------------------------------------------------
drop policy if exists "exam_questions_select" on public.exam_questions;
create policy "exam_questions_select" on public.exam_questions
  for select using (
    public.is_admin()
    or public.can_manage_exam(exam_id)
    or public.has_role('icerik_uzmani')
    or public.is_exam_assigned_to_current_user(exam_id)
  );

drop policy if exists "exam_questions_write_egitmen" on public.exam_questions;
create policy "exam_questions_write_egitmen" on public.exam_questions
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.exams e
      where e.id = exam_id and e.instructor_id = auth.uid()
    )
  );

-- --- submissions -----------------------------------------------------------
drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "submissions_update_egitmen" on public.submissions;
create policy "submissions_update_egitmen" on public.submissions
  for update using (public.is_admin() or public.has_role('egitmen'))
  with check (public.is_admin() or public.has_role('egitmen'));

-- --- question_preferences --------------------------------------------------
drop policy if exists "preferences_select" on public.question_preferences;
create policy "preferences_select" on public.question_preferences
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

-- 5. admin@t3.com hesabini admin yap ----------------------------------------
-- Rol alanlari `users_guard_role_columns` tetikleyicisiyle korunuyor; bayrak
-- tek bir DO blogunda aciliyor ki islem kapsami boyunca gecerli olsun.
do $$
begin
  perform set_config('app.role_change_allowed', 'on', true);

  update public.users
     set role           = 'admin',
         role_status    = 'onayli',
         requested_role = null
   where email = 'admin@t3.com';

  perform set_config('app.role_change_allowed', 'off', true);
end $$;

-- 6. Kontrol -----------------------------------------------------------------
-- select email, role, role_status from public.users order by role;
