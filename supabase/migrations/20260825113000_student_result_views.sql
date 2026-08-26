-- Ogrenciye yeni aciklanan sonuc bildirimi gosterebilmek icin sonuc
-- ayrintisinin ilk goruntulenme zamanini kalici olarak saklar.

begin;

alter table public.exam_attempts
  add column if not exists result_viewed_at timestamptz;

create index if not exists exam_attempts_unseen_result_idx
  on public.exam_attempts (student_id, completed_at desc)
  where status = 'sonuclandi' and result_viewed_at is null;

create or replace function public.mark_exam_result_viewed(target_exam uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Oturum acmaniz gerekiyor.' using errcode = '42501';
  end if;

  update public.exam_attempts
  set result_viewed_at = coalesce(result_viewed_at, now())
  where exam_id = target_exam
    and student_id = actor
    and status = 'sonuclandi';

  return found;
end;
$$;

revoke all on function public.mark_exam_result_viewed(uuid) from public;
grant execute on function public.mark_exam_result_viewed(uuid) to authenticated;

commit;
