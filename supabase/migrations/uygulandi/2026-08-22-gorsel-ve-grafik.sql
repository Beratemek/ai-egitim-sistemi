-- ---------------------------------------------------------------------------
-- Gorselli ve grafikli sorular
--
-- Sorular bugun yalnizca METIN. Grafik okuma, sema yorumlama, fotograf
-- inceleme gerektiren kazanimlar olculemiyor.
--
-- 1. questions.visual_json
--    Sorunun govdesine eklenen gorsel. Uc bicim var (bkz. lib/visual.ts):
--      - chart : model JSON yazar, recharts cizer
--      - svg   : model vektor cizim yazar (sema, geometri, devre)
--      - image : dis kaynaktan gorsel (Wikimedia Commons) + lisans bilgisi
--
--    NEDEN AI'A RESIM CIZDIRMIYORUZ: uretilen resim yanlis olabilir ve kimse
--    fark etmez ("kenarlari 3-4-5 olan ucgen" deyip 3-4-6 cizmek soruyu
--    bozar). Chart ve SVG'de model SAYIYI yazar, cizimi kod yapar - hata
--    payi sifir. Ayrica gorsel uretimi metin uretiminden kat kat pahali ve
--    ucretsiz katman kotasi zaten dar.
--
--    Sik bazli gorseller ayri sutun ISTEMEZ: options_json zaten jsonb, her
--    sikkin icine ayni bicimde bir `visual` alani giriyor.
--
-- 2. get_student_exam_questions() yeniden olusturuluyor
--    KRITIK: ogrenci sorulari bu SECURITY DEFINER fonksiyonundan geliyor ve
--    donus semasi SABIT. Fonksiyon guncellenmezse gorseller yalnizca
--    egitmen ekraninda gorunur, SINAVDA KAYBOLUR. Kolon eklemek donus tipini
--    degistirdigi icin CREATE OR REPLACE yetmiyor; once drop gerekiyor.
--
-- Idempotent: iki kez calistirmak sorun degil.
-- ---------------------------------------------------------------------------

begin;

-- 1. Gorsel yuku -----------------------------------------------------------
alter table public.questions
  add column if not exists visual_json jsonb;

comment on column public.questions.visual_json is
  'Soru govdesine eklenen gorsel: {kind:"chart"|"svg"|"image", ...}. bkz. lib/visual.ts';

-- 2. Ogrenciye goturen RPC gorseli de tasisin ------------------------------
-- Donus tipi degistigi icin once dusuruluyor.
drop function if exists public.get_student_exam_questions(uuid);

create function public.get_student_exam_questions(target_exam uuid)
returns table (
  id uuid,
  subject text,
  topic text,
  text text,
  type public.question_type,
  options_json jsonb,
  visual_json jsonb,
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
    q.visual_json,
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

-- DIKKAT: dogru cevap ve rubrik BURADA YOK ve olmamali. Ogrenci istemcisine
-- giden tek soru kaynagi bu fonksiyon; alan eklerken listeye bakip
-- `correct_answer` / `rubric` eklenmedigini dogrulayin.
revoke all on function public.get_student_exam_questions(uuid) from public;
grant execute on function public.get_student_exam_questions(uuid) to authenticated;

commit;
