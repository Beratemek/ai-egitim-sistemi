-- Sinav kaniti olustuktan sonra soru yapisini ve olcme anlamini korur.
--
-- Kilit ilk exam_attempts veya submissions satirinda devreye girer. Yalnizca
-- yayindan kaldirmak kilidi acmaz: ogrencinin gordugu soru/puan yapisi ile
-- raporlanan sonucun sonradan farklilasmasi engellenir.

begin;

-- RLS altindaki kullanicilar attempt/submission satirlarini her zaman
-- goremez. Kilit karari bu nedenle tablo sahibinin haklariyla ve tek bir
-- merkezi fonksiyonla verilir.
create or replace function public.is_exam_structure_locked(target_exam uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_exam is not null and (
    exists (
      select 1
      from public.exam_attempts attempt
      where attempt.exam_id = target_exam
    )
    or exists (
      select 1
      from public.submissions submission
      where submission.exam_id = target_exam
    )
  );
$$;

revoke all on function public.is_exam_structure_locked(uuid) from public;
grant execute on function public.is_exam_structure_locked(uuid) to authenticated;

create or replace function public.is_question_used_in_locked_exam(target_question uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_question is not null and exists (
    select 1
    from public.exam_questions exam_question
    where exam_question.question_id = target_question
      and public.is_exam_structure_locked(exam_question.exam_id)
  );
$$;

revoke all on function public.is_question_used_in_locked_exam(uuid) from public;
grant execute on function public.is_question_used_in_locked_exam(uuid) to authenticated;

-- RLS, normal istemci yazmalarini erkenden keser. Trigger ise service_role,
-- SECURITY DEFINER fonksiyonlari ve olasi dogrudan SQL gibi RLS'yi asan
-- yollarda da degismezlik kuralini uygular.
drop policy if exists "exam_questions_write_egitmen" on public.exam_questions;
create policy "exam_questions_write_egitmen" on public.exam_questions
  for all
  using (
    not public.is_exam_structure_locked(exam_id)
    and (
      public.is_admin()
      or exists (
        select 1
        from public.exams exam
        where exam.id = exam_questions.exam_id
          and exam.instructor_id = auth.uid()
      )
    )
  )
  with check (
    not public.is_exam_structure_locked(exam_id)
    and (
      public.is_admin()
      or exists (
        select 1
        from public.exams exam
        where exam.id = exam_questions.exam_id
          and exam.instructor_id = auth.uid()
      )
    )
  );

create or replace function public.guard_exam_question_structure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.is_exam_structure_locked(new.exam_id) then
      raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Soru yapisi artik degistirilemez.'
        using errcode = '55000';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.is_exam_structure_locked(old.exam_id) then
      raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Soru yapisi artik degistirilemez.'
        using errcode = '55000';
    end if;
    return old;
  end if;

  -- UPDATE, hem eski hem yeni sinavi denetler. Boylece kilitli bir satir
  -- baska sinava tasinarak ya da baska sinavdan kilitli sinava sokularak
  -- kural asilamaz.
  if public.is_exam_structure_locked(old.exam_id)
     or public.is_exam_structure_locked(new.exam_id) then
    raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Soru sirasi ve puanlari artik degistirilemez.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_exam_question_structure() from public;

drop trigger if exists exam_questions_structure_lock on public.exam_questions;
create trigger exam_questions_structure_lock
  before insert or update or delete on public.exam_questions
  for each row execute function public.guard_exam_question_structure();

-- Bir havuz sorusu birden cok sinavda kullanilabilir. Bunlardan herhangi
-- birinde kanit olustuysa, sorunun olcme anlamini degistiren alanlar artik
-- ortak soru kaydinda degistirilemez. Durum/onay ve inceleme metadatasi bu
-- alanlarin disindadir.
create or replace function public.guard_locked_exam_question_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if public.is_question_used_in_locked_exam(old.id) then
      raise exception 'Bu soru baslanmis bir sinavda kullaniliyor ve silinemez.'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if (
    old.id is distinct from new.id
    or old.category is distinct from new.category
    or old.subject is distinct from new.subject
    or old.topic is distinct from new.topic
    or old.text is distinct from new.text
    or old.type is distinct from new.type
    or old.options_json is distinct from new.options_json
    or old.visual_json is distinct from new.visual_json
    or old.correct_answer is distinct from new.correct_answer
    or old.rubric is distinct from new.rubric
    or old.difficulty is distinct from new.difficulty
    or old.status is distinct from new.status
    or old.outcome_id is distinct from new.outcome_id
  ) and public.is_question_used_in_locked_exam(old.id) then
    raise exception 'Bu soru baslanmis bir sinavda kullaniliyor. Olcme icerigi ve kazanim baglantisi degistirilemez.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_locked_exam_question_content() from public;

drop trigger if exists questions_locked_exam_content on public.questions;
create trigger questions_locked_exam_content
  before update or delete on public.questions
  for each row execute function public.guard_locked_exam_question_content();

-- Normal DELETE isteklerini de RLS katmaninda erkenden reddet. Trigger
-- ayricalikli yollar icin nihai guvence olmaya devam eder.
drop policy if exists "questions_delete_egitmen" on public.questions;
create policy "questions_delete_egitmen" on public.questions
  for delete using (
    (public.is_admin() or public.has_role('egitmen'))
    and not public.is_question_used_in_locked_exam(id)
  );

-- Sinavin kendisini silmek, altindaki attempt/submission ve soru yapisini
-- cascade ile birlikte yok eder. Cascade tetikleyicilerinin calisma sirasina
-- guvenmek yerine sinav satirini en basta koruyoruz.
create or replace function public.guard_locked_exam_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_exam_structure_locked(old.id) then
    raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Sinav silinemez.'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke all on function public.guard_locked_exam_delete() from public;

drop trigger if exists exams_structure_lock_delete on public.exams;
create trigger exams_structure_lock_delete
  before delete on public.exams
  for each row execute function public.guard_locked_exam_delete();

-- Bu fonksiyon eskiden SECURITY DEFINER olmasina ragmen authenticated rolune
-- dogrudan acikti. Yetki kontrolu yapmadigi icin herhangi bir kullanici baska
-- bir sinavin puanlarini degistirebiliyordu. Artik yalnizca tetikleyici ve
-- asagidaki yetkili reset fonksiyonu icinden cagrilabilir.
create or replace function public.redistribute_exam_points(target_exam uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  question_count integer;
  base_points integer;
  remainder integer;
begin
  if public.is_exam_structure_locked(target_exam) then
    raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Puanlar artik degistirilemez.'
      using errcode = '55000';
  end if;

  select count(*) into question_count
  from public.exam_questions
  where exam_id = target_exam;

  if question_count = 0 then
    return 0;
  end if;

  if question_count > 100 then
    update public.exam_questions
    set points = 1
    where exam_id = target_exam;
    return question_count;
  end if;

  base_points := 100 / question_count;
  remainder := 100 - base_points * question_count;

  update public.exam_questions target
  set points = base_points + case when ordered.row_index <= remainder then 1 else 0 end
  from (
    select question_id,
           row_number() over (order by position, question_id) as row_index
    from public.exam_questions
    where exam_id = target_exam
  ) as ordered
  where target.exam_id = target_exam
    and target.question_id = ordered.question_id;

  return 100;
end;
$$;

revoke all on function public.redistribute_exam_points(uuid) from public;
revoke execute on function public.redistribute_exam_points(uuid) from anon, authenticated;

-- Esit dagitim yalnizca sinav sahibi veya sistem yoneticisi tarafindan ve
-- henuz kanit olusmamisken calisir. Egitim yoneticisinin raporlama yetkisi
-- sinav yapisini degistirme yetkisine donusmez.
create or replace function public.reset_exam_points(target_exam uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (
    public.is_admin()
    or exists (
      select 1
      from public.exams exam
      where exam.id = target_exam
        and exam.instructor_id = auth.uid()
    )
  ) then
    raise exception 'Bu sinavin puanlarini degistirme yetkiniz yok.'
      using errcode = '42501';
  end if;

  if public.is_exam_structure_locked(target_exam) then
    raise exception 'Bu sinava baslanmis veya cevap kaydi olusmus. Puanlar artik degistirilemez.'
      using errcode = '55000';
  end if;

  update public.exams
  set points_auto = true
  where id = target_exam;

  return public.redistribute_exam_points(target_exam);
end;
$$;

revoke all on function public.reset_exam_points(uuid) from public;
grant execute on function public.reset_exam_points(uuid) to authenticated;

commit;
