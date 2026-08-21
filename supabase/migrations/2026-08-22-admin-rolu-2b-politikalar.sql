-- ADIM 2b/3 - RLS politikalarina admin yetkisi
-- Once 2a calistirilmis olmali (is_admin fonksiyonu gerekiyor). Idempotenttir.

drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
  for select using (
    id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "outcomes_write_icerik_uzmani" on public.learning_outcomes;
create policy "outcomes_write_icerik_uzmani" on public.learning_outcomes
  for all using (public.is_admin() or public.has_role('icerik_uzmani'))
  with check (public.is_admin() or public.has_role('icerik_uzmani'));

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
    public.is_admin() or public.has_role('icerik_uzmani') or public.has_role('egitmen')
  )
  with check (
    public.is_admin() or public.has_role('icerik_uzmani') or public.has_role('egitmen')
  );

drop policy if exists "questions_delete_egitmen" on public.questions;
create policy "questions_delete_egitmen" on public.questions
  for delete using (public.is_admin() or public.has_role('egitmen'));

drop policy if exists "exams_select" on public.exams;
create policy "exams_select" on public.exams
  for select using (
    public.is_admin()
    or instructor_id = auth.uid()
    or public.has_role('icerik_uzmani')
    or public.has_role('egitim_yoneticisi')
    or (is_published and public.is_exam_assigned_to_current_user(exams.id))
  );

drop policy if exists "exams_write_egitmen" on public.exams;
create policy "exams_write_egitmen" on public.exams
  for all using (
    public.is_admin() or (public.has_role('egitmen') and instructor_id = auth.uid())
  )
  with check (
    public.is_admin() or (public.has_role('egitmen') and instructor_id = auth.uid())
  );

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
    or exists (select 1 from public.exams e where e.id = exam_id and e.instructor_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.exams e where e.id = exam_id and e.instructor_id = auth.uid())
  );

drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions
  for select using (
    public.is_admin() or public.has_role('egitmen') or public.has_role('egitim_yoneticisi')
  );

drop policy if exists "submissions_update_egitmen" on public.submissions;
create policy "submissions_update_egitmen" on public.submissions
  for update using (public.is_admin() or public.has_role('egitmen'))
  with check (public.is_admin() or public.has_role('egitmen'));

drop policy if exists "preferences_select" on public.question_preferences;
create policy "preferences_select" on public.question_preferences
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_role('egitmen')
    or public.has_role('egitim_yoneticisi')
  );
