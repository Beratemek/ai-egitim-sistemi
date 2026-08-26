/*
 * Ogrencinin SINAV NOTU her zaman TAM SAYI.
 *
 * Neden: 83.33 gibi bir not ogrenciye hicbir sey anlatmiyor. Ondalik yalnizca
 * TOPLULUK sayilarinda anlamli - bir sinifin ortalamasinin 83.3 olmasi bilgi
 * tasir, tek bir ogrencinin notunun 83.33 olmasi tasimaz.
 *
 * DIKKAT - `submissions.ai_score` ve `instructor_approved_score` KASITLI
 * OLARAK ondalikli kalir. Bu kolonlar puan degil YUZDE tutuyor (bkz.
 * lib/score-scale.ts): 30 puanlik bir sorudan verilen TAM 25 puan, yuzde
 * olarak 83.33 diye saklaniyor. Bunlari tam sayiya zorlamak %83 x 30 = 24.9
 * demek olurdu - yani ogrencinin tam puan ALAMAMASI. Ondalik orada bir kusur
 * degil, tam puanin tasiyicisi.
 *
 * Bu yuzden kural yalnizca zincirin SONUNA uygulanir: sorularin agirlikli
 * toplamindan cikan `exam_attempts.final_score`.
 *
 * `round(x)` PostgreSQL'de yarim degerleri sifirdan UZAGA yuvarlar
 * (round(82.5) = 83) - sinirdaki ogrencinin lehine olan davranis budur.
 */

-- 1) Nihai puani tam sayi olarak hesapla.
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
    -- Ogrenciye "25 / 30 puan" diye gosterilen sayilar; ikisi de tam.
    -- Yuvarlama final_score'u ETKILEMEZ: asagidaki hesap ham `earned`i kullanir.
    earned_points = round(earned),
    total_points = round(total),
    -- TAM SAYI: ondalik yok.
    final_score = round(earned / total * 100.0)
  where exam_id = target_exam and student_id = target_student;

  return found;
end;
$$;

revoke all on function public.recalculate_exam_attempt_result(uuid, uuid) from public;
grant execute on function public.recalculate_exam_attempt_result(uuid, uuid) to authenticated;

-- 2) Kesinlesmis sinav notlarini ve puan kirilimini tam sayiya cek.
update public.exam_attempts
set
  final_score = round(final_score),
  earned_points = round(earned_points),
  total_points = round(total_points)
where (final_score is not null and final_score <> round(final_score))
   or (earned_points is not null and earned_points <> round(earned_points))
   or (total_points is not null and total_points <> round(total_points));

/*
 * Bundan sonrasi icin veritabani seviyesinde guvence.
 *
 * Uygulama katmani da yuvarliyor, ama tek savunma orasi olmamali: bir
 * betik, elle calistirilan bir SQL ya da ileride eklenecek baska bir yol
 * ondalik yazabilir. Kisit, kuralin nerede saklandigini net kilar.
 */
alter table public.exam_attempts
  drop constraint if exists exam_attempts_final_score_tam_sayi;
alter table public.exam_attempts
  add constraint exam_attempts_final_score_tam_sayi
  check (final_score is null or final_score = round(final_score));
