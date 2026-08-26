-- ---------------------------------------------------------------------------
-- Kazanim baglama + ders bazli tarz hafizasi
--
-- IKI ISI BIRLIKTE YAPAR, cunku ikisi de ayni fikre dayaniyor: uretimin
-- baglami DERS + KONU + KAZANIM ucgeni.
--
-- 1. learning_outcomes.subject
--    Kazanimlar bugun yalnizca konuya bagli. Havuz "dal -> ders -> konu"
--    olarak kirildigi icin kazanim da derse baglanmali; aksi halde uretim
--    formunda "bu derse ait kazanimlar" listesi cikarilamiyor.
--
-- 2. question_preferences.subject + category
--    Tarz hafizasi bugun DERSSIZ tutuluyor ve getStyleGuide() hicbir filtre
--    uygulamiyor: son 6 begeni + son 6 red, ders ayrimi olmadan modele
--    gidiyor. Sonuc: tarihte "sozel olsun" diye verilen geri bildirim
--    matematik uretimini de etkiliyor. Bu sutunlar hafizayi ders/konu
--    kapsamina almak icin gerekli.
--
-- category TEXT olarak tanimlandi (enum degil): bu kolon yalnizca filtreleme
-- ve prompt baglami icin okunuyor, referans butunlugu gerektiren bir yerde
-- kullanilmiyor. Enum'a baglamak eski kayitlari ve mock veriyi kirardi.
--
-- Idempotent: iki kez calistirmak sorun degil.
-- ---------------------------------------------------------------------------

-- 1. Kazanimlar derse baglanir --------------------------------------------
alter table public.learning_outcomes
  add column if not exists subject text;

comment on column public.learning_outcomes.subject is
  'Kazanimin ait oldugu ders. Uretim formunda kazanim listesi bununla suzulur.';

-- Uretim formu "bu ders + bu konu" kazanimlarini cekiyor.
create index if not exists learning_outcomes_ders_konu_idx
  on public.learning_outcomes (subject, topic);

-- 2. Tarz hafizasi ders/konu kapsamina alinir -----------------------------
alter table public.question_preferences
  add column if not exists subject text;

alter table public.question_preferences
  add column if not exists category text;

comment on column public.question_preferences.subject is
  'Geri bildirimin verildigi ders. getStyleGuide() once ayni dersin orneklerini kullanir.';

comment on column public.question_preferences.category is
  'DENEYAP atolye dali. Ders adi ayni olsa da dal farkliysa tarz farkli olabilir.';

-- getStyleGuide() sorgusunun tam karsiligi: kullanici + kapsam + tarih.
create index if not exists question_preferences_kapsam_idx
  on public.question_preferences (user_id, subject, topic, created_at desc);
