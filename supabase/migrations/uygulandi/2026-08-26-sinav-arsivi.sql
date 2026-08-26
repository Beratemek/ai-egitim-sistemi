-- ---------------------------------------------------------------------------
-- Sinav arsivi: "sil" demek listeden kaldirmak demektir, veriyi yok etmek degil
--
-- SORUN: Egitmen sinav biriktikce listeyi toparlamak istiyor ama silemiyordu.
-- Veritabaninda `exams` uzerinde bir koruma tetikleyicisi var ve sinava
-- baslanmis ya da cevap yazilmissa silmeyi reddediyor:
--
--     "Bu sinava baslanmis veya cevap kaydi olusmus. Sinav silinemez."
--
-- Tetikleyici DOGRU davraniyor: o sinavin cevaplari ogrencinin karnesinde,
-- egitmenin kontrol sayfasinda ve egitim yoneticisinin raporlarinda yasiyor.
-- Sinavi gercekten silmek bu uc yeri birden bozardi.
--
-- COZUM: iki ayri islem.
--
--   ARSIVLE  -> `archived_at` dolar. Sinav egitmenin listesinden cikar; ama
--               kontrol sayfasi, yonetici raporlari ve ogrencinin kendi sonuc
--               ekrani onu gormeye devam eder. Geri alinabilir.
--
--   KALICI SIL -> `delete_exam_permanently()`. Cocuk kayitlari once siler,
--               boylece koruma tetikleyicisi engel olmaz. Geri alinamaz;
--               yalnizca kontrol sayfasindan, bilerek cagrilir.
--
-- Ucuncu bir yetki de eklendi: egitim yoneticisi TEK bir ogrencinin TEK bir
-- sinavdan gelen verisini silebilir (`delete_student_exam_data`). Sinavin
-- kendisi ve diger ogrencilerin verisi durur.
--
-- Idempotenttir.
-- ---------------------------------------------------------------------------

-- 1. Arsiv sutunu ----------------------------------------------------------

alter table public.exams
  add column if not exists archived_at timestamptz;

comment on column public.exams.archived_at is
  'Dolu ise egitmen sinavi listeden kaldirmistir. Veri DURUR: kontrol sayfasi, yonetici raporlari ve ogrencinin sonuc ekrani arsivlenmis sinavi da gosterir.';

-- Kismi indeks: sorgularin ezici cogunlugu "arsivlenmemisler" diye filtreliyor.
create index if not exists exams_not_archived_idx
  on public.exams (created_at desc)
  where archived_at is null;

-- Arsivleme ayri bir politika istemez: `exams_write_egitmen` zaten `for all`
-- ve `instructor_id = auth.uid()` kosuluyla calisiyor, yani egitmen yalnizca
-- KENDI sinavini arsivleyebilir. Bu migration o politikayi degistirmez.


-- 2. Kalici silme ----------------------------------------------------------

create or replace function public.delete_exam_permanently(target_exam uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `security definer` oldugu icin RLS devrede degil; yetkiyi elle kontrol et.
  if not exists (
    select 1
    from public.exams
    where id = target_exam
      and (instructor_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Bu sinavi silme yetkiniz yok.'
      using errcode = '42501';
  end if;

  -- SIRA ONEMLI. `exams` uzerindeki koruma tetikleyicisi, sinava baslanmis ya
  -- da cevap yazilmissa silmeyi reddediyor. Cocuk kayitlar once temizlenince
  -- tetikleyici bakacak bir kayit bulamaz ve silme gecer. (Cascade'e
  -- guvenilemez: tetikleyici cascade'den ONCE calisir.)
  delete from public.submissions       where exam_id = target_exam;
  delete from public.exam_attempts     where exam_id = target_exam;
  delete from public.exam_assignments  where exam_id = target_exam;
  delete from public.exam_questions    where exam_id = target_exam;
  delete from public.exams             where id      = target_exam;
end;
$$;

grant execute on function public.delete_exam_permanently(uuid) to authenticated;

comment on function public.delete_exam_permanently(uuid) is
  'Sinavi ve TUM cevaplarini kalici siler. Geri alinamaz; arsivleme yetmediginde kullanilir.';


-- 3. Egitim yoneticisi: tek ogrencinin tek sinavdaki verisi -----------------

create or replace function public.delete_student_exam_data(
  target_exam    uuid,
  target_student uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role('egitim_yoneticisi') or public.is_admin()) then
    raise exception 'Bu islem yalnizca egitim yoneticisi tarafindan yapilir.'
      using errcode = '42501';
  end if;

  -- Cevaplar VE deneme kaydi birlikte gider: ogrenci o sinava hic girmemis
  -- sayilir ve sinif istatistiklerinden de duser. Yalnizca cevaplar silinip
  -- deneme kaydi birakilsaydi ogrenci "girdi ama bos" gorunur, ortalamayi
  -- sifir puanla asagi cekerdi - istenen bu degil.
  delete from public.submissions
   where exam_id = target_exam and student_id = target_student;

  delete from public.exam_attempts
   where exam_id = target_exam and student_id = target_student;
end;
$$;

grant execute on function public.delete_student_exam_data(uuid, uuid) to authenticated;

comment on function public.delete_student_exam_data(uuid, uuid) is
  'Bir ogrencinin bir sinavdaki cevaplarini ve deneme kaydini siler. Yalnizca egitim yoneticisi.';
