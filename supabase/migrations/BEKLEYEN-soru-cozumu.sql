-- ============================================================================
--  Soru çözümü
--  ---------------------------------------------------------------------------
--  NEDEN: Öğrenci bir soruyu yanlış yaptığında bugün yalnızca "yanlış cevap"
--  geri bildirimini görüyor. AI çalışma koçu konuyu anlatıyor ama O SORUYU
--  çözmüyor; öğrenci "anladım ama bu soruyu nasıl yapacaktım" diye kalıyor.
--
--  Çözüm SORUYA ait, öğrenciye değil: aynı sorunun çözümü 30 öğrenci için de
--  aynıdır. Bu yüzden öğrenci başına değil, SORU BAŞINA bir kez üretilip
--  burada saklanıyor. Koçun çıktısı öğrenciye özel olduğu için saklanamıyordu;
--  çözüm öyle değil.
--
--  Alan yapısı için bkz. lib/solution.ts. Özet: kavram + adımlar + şık şık
--  değerlendirme + sonuç. Adımlar ve şıklar İSTEĞE BAĞLI - matematikte
--  adımlar dolar, tarihte boş kalır, dil bilgisinde şıklar ağırlık taşır.
--
--  ÜRETİM: içerik uzmanının onayına girmiyor; `npm run cozum:uret` betiğiyle
--  toplu üretiliyor (bilinçli karar). Bu yüzden öğrenciye gösterilirken yapay
--  zekâ ürünü olduğu yazılıyor ve eğitmen sonradan düzeltebiliyor.
--
--  IDEMPOTENT: iki kez çalıştırılabilir.
-- ============================================================================

-- --- 1) Sütun --------------------------------------------------------------
alter table public.questions
  add column if not exists solution_json jsonb;

comment on column public.questions.solution_json is
  'Sorunun adım adım çözümü: kavram, adımlar, şık değerlendirmesi, sonuç. Yapay zekâ üretir, soru başına bir kez saklanır. Şema: lib/solution.ts';

-- --- 2) Üretilmemiş çözümleri bulmak için indeks ---------------------------
-- `npm run cozum:uret` betiği "onaylı ama çözümü olmayan" soruları tarıyor.
-- Kısmi indeks yalnızca o satırları kapsıyor; havuz büyüdükçe tarama
-- maliyeti artmasın.
create index if not exists questions_cozumsuz_idx
  on public.questions (status)
  where solution_json is null;

-- --- 3) Doğrulama ----------------------------------------------------------
-- Çalıştırdıktan sonra: kaç sorunun çözümü var, kaçının yok?
--
--   select status,
--          count(*) filter (where solution_json is not null) as cozumlu,
--          count(*) filter (where solution_json is null)     as cozumsuz
--   from public.questions
--   group by status;
