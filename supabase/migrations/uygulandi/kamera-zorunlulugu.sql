-- ---------------------------------------------------------------------------
-- Sinavda kamera zorunlulugu
--
-- Egitmen sinavi dersliklere atarken kamera+mikrofon zorunlulugu koyabilsin.
-- Zorunluysa ogrenci sinavi ancak kamerasi ve mikrofonu acikken cozebilir;
-- sorular tek tek ilerler.
--
-- Ayar SINAV BASINA tutuluyor, atama basina degil. Sinavin butunlugu sinavin
-- kendi ozelligidir: ayni sinavin Derslik-1'de kamerali, Derslik-3'te
-- kamerasiz olmasi hem denetimi anlamsizlastirir hem de ayni kagidin iki
-- farkli kosulda cozulmesi demektir.
--
-- NOT: kayit (video yukleme) BU ADIMDA YOK. Burada yapilan, sinav suresince
-- kamera ve mikrofon akisinin ACIK OLMASINI sart kosmak. Kayit; depolama
-- kovasi, saklama suresi ve acik riza gerektirdigi icin ayri bir is.
--
-- Onkosul: uygulandi/2026-08-22-ders-yetkisi.sql
-- Idempotenttir.
-- ---------------------------------------------------------------------------

alter table public.exams
  add column if not exists proctored boolean not null default false;

comment on column public.exams.proctored is
  'Sinav kamera+mikrofon acikken cozulmek zorunda mi? Egitmen belirler.';

-- Kontrol ------------------------------------------------------------------
-- select title, subject, proctored from public.exams order by created_at desc;
