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

-- --- 4) Doğrulama ----------------------------------------------------------
-- Çalıştırdıktan sonra bu sorgu her zorluk için satır sayısını vermeli.
-- (Migration'ın kendisi değil, gözle kontrol için.)
--
--   select difficulty, count(*) from public.questions group by difficulty;
