# Ogrenci degerlendirme guvenligi

Bu katman, sinavdaki bazi cevaplar egitmen tarafindan onaylanmis olsa bile
ogrencinin sonucu sinavin tamami tamamlanmadan gormemesini garanti eder.

## Korunan veriler

- `questions.correct_answer` ve `questions.rubric` ogrenciye tablo sorgusuyla
  acilmaz. Ogrenci yalnizca guvenli soru RPC'sini kullanir.
- `submissions.ai_score`, `ai_feedback`, `ai_criteria_json`,
  `instructor_approved_score`, `instructor_note` ve `reviewed_by` alanlari
  `exam_attempts.status = 'sonuclandi'` olana kadar maskelenir.
- Ogrenci yalnizca taslak `answer_text` alanini yazabilir. AI puani, durum,
  soru, sinav ve ogrenci kimligi veritabanindaki tetikleyiciyle korunur.
- Gelisim ve kisisel calisma onerileri yalnizca `sonuclandi` sinavlarin egitmen
  onayli cevaplarindan hesaplanir.

## Ortak Supabase'e gecis sirasi

1. Supabase Dashboard > Project Settings > API Keys bolumundeki gizli
   `secret`/`service_role` anahtarini yerel `.env.local` dosyasina
   `SUPABASE_SERVICE_ROLE_KEY` olarak ekleyin. Anahtari Git'e koymayin.
2. Uygulamayi yeniden baslatin ve mevcut bir sinavin teslim/AI puanlama
   akisinin sunucu tarafinda calistigini dogrulayin.
3. SQL Editor'de
   `supabase/migrations/20260821203000_student_assessment_security.sql`
   dosyasini calistirin.
4. Ogrenci hesabi ile ham `questions` ve `submissions` tablo sorgularinin veri
   dondurmedigini; uygulamadaki sinav ve sonuc ekranlarinin calistigini test edin.
5. Yeni bir sinavda ogrenci -> AI on degerlendirme -> egitmen onayi -> nihai
   sonuc -> gelisim/oneriler zincirini uctan uca tamamlayin.

Migration, ilk uc adim birlikte hazir olmadan uygulanmamalidir. Aksi halde RLS
dogru cevabi korur ancak service role anahtari olmayan sunucu AI puanlama icin
gizli soru alanlarini okuyamaz.
