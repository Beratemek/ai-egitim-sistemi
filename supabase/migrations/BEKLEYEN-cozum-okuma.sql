-- ============================================================================
--  Öğrencinin çözüm okuma kapısı
--  ---------------------------------------------------------------------------
--  NEDEN AYRI BİR RPC: öğrenci `questions` tablosundan HİÇBİR satır okuyamaz
--  (questions_select politikasında `ogrenci` yok) - bu bilinçli, çünkü RLS
--  satır bazlıdır ve bir kolonu gizleyemez; `correct_answer` ile `rubric`
--  aynı satırda durduğu için satırın tamamı kapalı tutuluyor.
--
--  Çözümü mevcut `get_student_exam_questions` RPC'sine EKLEMEK yanlış olurdu:
--  o sorgu SINAV SÜRERKEN çalışıyor. Çözüm oraya konsaydı öğrenci sınav
--  sırasında cevabı okurdu - dört katmanda korunan cevap anahtarı güvencesi
--  kendi elimizle delinmiş olurdu.
--
--  Bu yüzden çözümün kendi dar kapısı var ve tek bir şartı zorluyor:
--
--      Öğrencinin O SINAVDA durumu 'sonuclandi' olan bir denemesi olmalı.
--
--  Yani sınav bitmeden, notlar açıklanmadan çözüm görünmez. Devam eden ya da
--  değerlendirilmekte olan sınavda bu fonksiyon hiçbir satır döndürmez.
--
--  Fonksiyon YALNIZCA question_id ve solution_json döndürür. Soru metni,
--  şıklar, doğru cevap ve rubrik BURADAN GEÇMEZ - onları öğrenci zaten
--  kendi sınav akışından görüyor, burada tekrar etmek gereksiz bir yüzey
--  açardı.
--
--  IDEMPOTENT: iki kez çalıştırılabilir.
-- ============================================================================

begin;

create or replace function public.get_my_solutions(target_exam uuid default null)
returns table (
  question_id uuid,
  solution_json jsonb
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

  return query
  select distinct
    question.id as question_id,
    question.solution_json
  from public.exam_attempts attempt
  join public.exam_questions link
    on link.exam_id = attempt.exam_id
  join public.questions question
    on question.id = link.question_id
  where attempt.student_id = actor
    -- TEK ve EN ONEMLI kosul: sinav sonuclanmis olmali.
    and attempt.status = 'sonuclandi'
    and question.solution_json is not null
    and (target_exam is null or attempt.exam_id = target_exam);
end;
$$;

revoke all on function public.get_my_solutions(uuid) from public;
grant execute on function public.get_my_solutions(uuid) to authenticated;

commit;

-- --- Doğrulama --------------------------------------------------------------
-- Öğrenci hesabıyla çağrıldığında yalnızca SONUÇLANMIŞ sınavlarındaki
-- çözümlü sorular dönmeli:
--
--   select count(*) from public.get_my_solutions();
--
-- Devam eden bir sınavın kimliğiyle çağrıldığında 0 satır dönmeli:
--
--   select count(*) from public.get_my_solutions('<devam-eden-sinav-id>');
