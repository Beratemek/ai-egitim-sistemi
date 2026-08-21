# Dijle Bugun Yeni Yemek Yapti, Okuyun

Bu dokuman, 21 Agustos 2026 tarihinde ogrenci paneli ve ogrenci sinav akisi
icin yapilan gelistirmeleri ekip arkadaslarina aktarmak amaciyla hazirlandi.

> Guvenlik notu: Bu dokumanda Supabase URL'si, publishable key, secret key,
> kullanici e-postasi veya parola bulunmaz. Gercek anahtarlar yalnizca yerel
> `.env.local` dosyasinda tutulmalidir.

## 1. Mevcut durum

- Uygulama ortak, uzaktaki Supabase projesiyle calisiyor.
- Ogrenci sinav atama ve sinav oturumu altyapisi ortak veritabanina uygulandi.
- Ogrenci degerlendirme guvenligi migration'i ortak veritabanina uygulandi.
- Mevcut veriler silinmedi:
  - `exam_assignments`: 4 kayit
  - `exam_attempts`: 1 kayit
  - `questions`: 25 kayit
  - `submissions`: 3 kayit
- Yerel uygulama `http://localhost:8080` adresinde calisiyor.

## 2. Veritabanina eklenen ogrenci sinav modeli

Uygulanan migration:

```text
supabase/migrations/20260821170000_student_exam_flow.sql
```

Bu migration ile:

- `exam_assignments` tablosu eklendi.
  - Bir sinavin hangi ogrenciye atandigini tutar.
  - Atama tarihi ve ogrenciye ozel son teslim tarihi saklanabilir.
- `exam_attempts` tablosu eklendi.
  - Ogrencinin sinavi ne zaman baslattigini tutar.
  - Sinav durumu `devam_ediyor`, `degerlendiriliyor` veya `sonuclandi` olur.
  - Nihai puan, kazanilan puan ve toplam puan burada saklanir.
- `submissions.ai_criteria_json` alani eklendi.
  - AI degerlendirmesinin rubrik/kriter kirilimlarini saklar.
- `start_exam_attempt()` fonksiyonu eklendi.
  - Yalnizca kendisine atanmis, yayindaki ve suresi dolmamis sinavi baslatir.
- `submit_exam_attempt()` fonksiyonu eklendi.
  - Tum cevaplar degerlendirmeye gonderildikten sonra sinavi teslim eder.
- `recalculate_exam_attempt_result()` fonksiyonu eklendi.
  - Tum sorular egitmen tarafindan onaylandiginda agirlikli nihai puani hesaplar.
- `get_student_exam_questions()` fonksiyonu eklendi.
  - Ogrenciye soru metni ve secenekleri verir.
  - Dogru cevap ve rubrigi ogrenciye gondermez.
- Atama ve attempt tablolari icin RLS politikalari eklendi.
- Eski yayinlanmis sinavlar ve cevaplar yeni modele veri kaybetmeden tasindi.

## 3. Uygulanan degerlendirme guvenligi

Uygulanan migration:

```text
supabase/migrations/20260821203000_student_assessment_security.sql
```

Bu migration ile:

- `get_my_submissions()` guvenli RPC'si eklendi.
- Ogrenci kendi cevap metnini gorebilir.
- Sinav tamamen `sonuclandi` olmadan su alanlar ogrenciye gonderilmez:
  - AI puani
  - AI geri bildirimi
  - Rubrik kriterleri
  - Egitmen onayli puan
  - Egitmen notu
  - Inceleyen egitmen bilgisi
- Ogrencinin tarayicidan sahte AI puani veya sahte durum yazmasi engellendi.
- Ogrenci yalnizca acik bir sinav oturumundaki taslak cevap metnini degistirebilir.
- Ogrencinin `questions` tablosundan dogru cevap veya rubrik okuması engellendi.
- Ham `submissions` satirlari ogrenciye kapatildi; ogrenci guvenli RPC'yi kullanir.
- Egitmen, icerik uzmani ve egitim yoneticisinin gerekli soru erisimleri korundu.
- Egitmen ve egitim yoneticisinin cevap inceleme erisimleri korundu.

## 4. Sunucu anahtari

AI puanlama islemlerinin guvenli RLS politikalari sonrasinda calisabilmesi icin
yerel `.env.local` dosyasina su degisken eklendi:

```env
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
```

Gercek deger bu dokumana veya Git'e yazilmamalidir. Degisken:

- Yalnizca sunucu tarafinda kullanilir.
- `NEXT_PUBLIC_` on eki tasimaz.
- AI puanlama sirasinda gizli soru alanlarini okumak ve sonucu yazmak icin kullanilir.
- `.env.local` Git tarafindan yok sayilir.

Her ekip arkadasi kendi bilgisayarinda bu anahtari proje sahibinden guvenli bir
kanalla alip `.env.local` dosyasina eklemelidir.

## 5. Ogrenci panelinde tamamlanan akış

### Sinavlarim

- Yalnizca ogrenciye atanmis sinavlar listelenir.
- Sinavlar su durumlarla gosterilir:
  - Yaklasan
  - Baslanabilir
  - Devam ediyor
  - Suresi doldu
  - Onay bekliyor
  - Sonuclandi
- Ust istatistiklerde aktif, onay bekleyen ve sonuclanan sinav sayilari bulunur.
- Sinav gecmisi soru cevaplari yerine sinav bazinda gosterilir.
- Nihai puan, soru puanlarinin basit ortalamasi yerine
  `exam_attempts.final_score` alanindan okunur.

### Sinava baslama

- Ogrenci once sinav bilgi/baslangic ekranini gorur.
- `Sinava basla` islemi bir `exam_attempts` kaydi olusturur.
- Atanmamis, yayinlanmamis, henuz baslamamis veya suresi dolmus sinav baslatilamaz.

### Soru cevaplama

- Sorular tek soru odakli gezintiyle gosterilir.
- Onceki/sonraki soru tuslari ve soru numarasi navigasyonu bulunur.
- Coktan secmeli ve acik uclu cevap turleri desteklenir.
- Acik uclu cevap icin minimum karakter kontrolu vardir.
- Cevaplar once taslak olarak kaydedilir.
- Ogrenci sinavi teslim edene kadar taslagini degistirebilir.
- Kaydedilmemis tarayici taslagi `sessionStorage` icinde korunur.
- Kaydedilmemis cevapla sayfadan cikarken uyari verilir.
- Dogru cevap ve rubrik tarayiciya gonderilmez.

### Sure yonetimi

- Sinav bitis zamani icin geri sayim bulunur.
- Sure doldugunda kayitli cevaplar otomatik teslim edilir.
- Yanitsiz sorular sure doldugunda sifir puanlik yanitsiz cevap olarak kaydedilir.
- Suresi dolmus sinavda yeni cevap yazilamaz.

### Sinavi teslim etme

- Normal teslimde eksik cevap varsa teslim engellenir.
- Cevaplar AI on degerlendirmesine toplu olarak gonderilir.
- AI servisi hata verirse ogrencinin kayitli taslaklari kaybolmaz.
- Teslim sonrasinda cevaplar kilitlenir.
- Ogrenci ara AI puanini gormez.
- Durum `degerlendiriliyor` olur ve egitmen onayi beklenir.

### Egitmen onayi ve nihai sonuc

- Egitmen AI puanini kabul edebilir veya degistirebilir.
- Egitmen not ekleyebilir.
- Tum sorular onaylanmadan sinav sonucu ogrenciye acilmaz.
- Tum sorular onaylaninca agirlikli nihai puan hesaplanir.
- Attempt durumu `sonuclandi` olur.
- Ogrenci daha sonra puan, geri bildirim ve rubrik kriterlerini gorebilir.

## 6. Yeni ogrenci sayfalari

Ogrenci sol menusunde artik uc bolum bulunur:

1. `Sinavlarim`
2. `Sonuclarim`
3. `Gelisimim`

### Sonuclarim

- Yalnizca `exam_attempts.status = 'sonuclandi'` sinavlari gosterir.
- Nihai puan, kazanilan/toplam puan ve aciklanma tarihi bulunur.
- Cevap ve geri bildirim ayrintisina gecis saglanir.

### Gelisimim

- Yalnizca tamamlanmis sinavlar hesaba katilir.
- Yalnizca egitmen onayli cevaplar kullanilir.
- Kazanim varsa kazanim bazli, yoksa konu bazli ortalama hesaplanir.
- Guclu ve gelistirilmesi gereken alanlar gosterilir.
- Onay bekleyen veya kismen onaylanmis sinavlar gelisim ortalamasini etkilemez.

## 7. Kisisellestirilmis calisma onerileri

Ogrencinin tamamlanan sinavlarindaki kazanım puanlarina gore calisma plani
olusturulur:

- `0-49`: Oncelikli tekrar
  - Temel konu anlatimi ve bes temel soru onerilir.
- `50-74`: Pratik gerekli
  - Geri bildirim inceleme ve uc uygulama sorusu onerilir.
- `75-100`: Pekistir
  - Daha zor uygulama sorusu ve cozumu aciklama onerilir.

Oneriler en dusuk puanli kazanimdan baslayarak siralanir ve hangi verilere
dayandigi ogrenciye gosterilir.

## 8. Kodda onemli dosyalar

```text
app/actions/submissions.ts
app/dashboard/ogrenci/page.tsx
app/dashboard/ogrenci/sinav/[examId]/page.tsx
app/dashboard/ogrenci/sonuclar/page.tsx
app/dashboard/ogrenci/gelisim/page.tsx
components/shared/answer-form.tsx
components/shared/student-exam-questions.tsx
components/shared/exam-start-panel.tsx
components/shared/exam-countdown.tsx
components/shared/exam-finalize-panel.tsx
lib/queries.ts
lib/student-exam-status.ts
lib/student-recommendations.ts
lib/exam-time.ts
supabase/migrations/20260821170000_student_exam_flow.sql
supabase/migrations/20260821203000_student_assessment_security.sql
```

Guvenlik gecis detaylari:

```text
docs/student-assessment-security.md
```

## 9. Test ve dogrulama durumu

Basariyla tamamlanan kontroller:

- TypeScript typecheck
- ESLint
- 5 adet ogrenci sinav akisi birim testi
- Next.js production build
- Login sayfasi HTTP kontrolu
- Ortak Supabase migration dogrulamasi
- Secret key ile salt okunur sunucu baglantisi
- Yeni `get_my_submissions()` RPC kontrolu
- Migration sonrasinda mevcut tablo kayit sayilarinin korunmasi

Kullanilabilecek komutlar:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
node scripts/verify-student-migration.mjs
node scripts/verify-student-security.mjs
```

## 10. Ekip arkadaslarinin yapmasi gerekenler

Projeyi kendi bilgisayarinda calistiracak herkes:

1. Guncel branch'i almalidir.
2. `npm install` calistirmalidir.
3. Kendi `.env.local` dosyasini olusturmalidir.
4. Ortak Supabase URL ve publishable key degerlerini eklemelidir.
5. `SUPABASE_SERVICE_ROLE_KEY` degerini proje sahibinden guvenli kanalla almalidir.
6. Gercek AI kullanilacaksa AI anahtarini eklemelidir.
7. `npm.cmd run dev` ile projeyi baslatmalidir.

Migration'lar ortak Supabase'e zaten uygulandi. Ekip arkadaslari SQL dosyalarini
yeniden calistirmamalidir.

## 11. Siradaki isler

- Egitmenin yeni ve gercek sorular iceren bir sinav olusturup ogrenciye atamasi.
- Ogrenci -> AI -> egitmen -> nihai sonuc zincirinin yeni sinavla uctan uca testi.
- Ogrenci yetkisiyle ham `questions` ve `submissions` sorgularinin RLS testleri.
- Mobil ekran ve klavye erisilebilirligi kontrolleri.
- Gercek AI modeli kullanilacaksa kota, hata ve zaman asimi senaryolari.
- E2E testlerinin otomatik hale getirilmesi.

## 12. Beklenen tam akış

```text
Egitmen sinavi olusturur ve ogrenciye atar
        -> Ogrenci sinavi baslatir
        -> Cevaplarini taslak kaydeder
        -> Ogrenci sinavi teslim eder / sure dolar
        -> AI on degerlendirme yapar
        -> Ogrenci puani goremez, onay bekler
        -> Egitmen tum cevaplari onaylar veya duzeltir
        -> Nihai agirlikli puan hesaplanir
        -> Sonuc ogrenciye acilir
        -> Tamamlanan sonuc gelisim hesabina katilir
        -> Kisisel calisma onerileri guncellenir
```

Bu zincirin veritabani ve uygulama altyapisi hazirdir. Yeni bir sinav atandiginda
uctan uca canli test yapilmasi kalmistir.
