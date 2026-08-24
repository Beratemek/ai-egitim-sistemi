-- ============================================================================
--  Soru zorluk derecesi
--  ---------------------------------------------------------------------------
--  NEDEN: Yapay zeka her ürettiği soru için bir zorluk tahmini veriyor
--  ("kolay" | "orta" | "zor" - bkz. lib/types.ts). Bu değer bugüne kadar
--  YALNIZCA `question_preferences` tablosuna, yani beğen/beğenme hafızasına
--  yazılıyordu; soru havuza (`public.questions`) kaydedilirken DÜŞÜYORDU.
--
--  Sonuç: havuzda yüzlerce soru var ama hiçbirinin zorluğu bilinmiyor.
--  Eğitmen "bu sınav orta seviye olsun" diyemiyor, içerik uzmanı da havuzu
--  zorluğa göre süzemiyordu.
--
--  Bu migration sütunu ekler. Var olan sorular varsayılan 'orta' olur -
--  uydurma bir dağıtım yapmaktansa hepsini nötr kabul etmek doğru; içerik
--  uzmanı zamanla düzeltebilir.
--
--  IDEMPOTENT: iki kez çalıştırılabilir, aynı sonucu verir.
-- ============================================================================

-- --- 1) Sütun --------------------------------------------------------------
alter table public.questions
  add column if not exists difficulty text not null default 'orta';

comment on column public.questions.difficulty is
  'Sorunun zorluk derecesi: kolay | orta | zor. AI üretirken tahmin eder, içerik uzmanı düzeltebilir.';

-- --- 2) Değer kısıtı -------------------------------------------------------
-- Serbest metin bırakılsaydı "Orta", "ORTA", "medium" gibi varyantlar birikir
-- ve filtre sessizce yanlış sayardı.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_difficulty_check'
  ) then
    alter table public.questions
      add constraint questions_difficulty_check
      check (difficulty in ('kolay', 'orta', 'zor'));
  end if;
end
$$;

-- --- 3) Filtre indeksi -----------------------------------------------------
-- Havuz ekranı ders + zorluk birlikte süzüyor.
create index if not exists questions_difficulty_idx
  on public.questions (difficulty);

create index if not exists questions_subject_difficulty_idx
  on public.questions (subject, difficulty);

-- --- 4) ESKİ SORULARIN ZORLUĞUNU GERİ GETİR --------------------------------
--  Sütun bugüne kadar YOKTU, yani havuza kaydedilen her sorunun yapay zeka
--  tahmini yazılırken düştü (app/actions/questions.ts içindeki geri düşüş).
--  Yukarıdaki `default 'orta'` bu soruların hepsini "Orta" yapar - oysa
--  aralarında gerçekte kolay ve zor olanlar var.
--
--  İyi haber: o bilgi TAMAMEN kaybolmadı. İçerik uzmanı bir taslağı
--  beğendiğinde/reddettiğinde `question_preferences` tablosuna soru metniyle
--  BİRLİKTE zorluğu da yazılıyordu. Soru metni üzerinden eşleştirip geri
--  alıyoruz.
--
--  Sınırı açıkça söylemek gerekir: bu yalnızca BEĞENİ KAYDI OLAN soruları
--  kurtarır. Hiç oy verilmemiş sorular "Orta" kalır - uydurmak yerine nötr
--  bırakmak doğru, içerik uzmanı zamanla düzeltebilir.
--
--  Yalnızca hâlâ varsayılan değerde olan satırlara dokunur; birisi zorluğu
--  elle değiştirdiyse üzerine yazmaz. Bu yüzden tekrar çalıştırmak güvenli.
with kurtarilan as (
  -- Aynı metin için birden fazla oy olabilir (iki kişi beğenmiş olabilir);
  -- zorluk aynı üretimden geldiği için hepsi aynıdır, yine de en yenisini
  -- alarak sonucu belirli kılıyoruz.
  select distinct on (p.question_text)
         p.question_text,
         p.difficulty
  from public.question_preferences p
  where p.difficulty in ('kolay', 'orta', 'zor')
  order by p.question_text, p.created_at desc
)
update public.questions q
set difficulty = k.difficulty,
    updated_at = now()
from kurtarilan k
where q.text = k.question_text
  and q.difficulty = 'orta'      -- yalnızca varsayılanda kalanlar
  and k.difficulty <> 'orta';    -- gerçekten bir şey değiştirecekse

-- --- 5) Doğrulama ----------------------------------------------------------
-- Çalıştırdıktan sonra bu sorgu her zorluk için satır sayısını vermeli.
-- (Migration'ın kendisi değil, gözle kontrol için.)
--
--   select difficulty, count(*) from public.questions group by difficulty;
