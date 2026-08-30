# Sınav Kestirimi ve Kalibrasyon

> Soru kalitesi ölçümü için bkz. [`sanal-sinif.md`](sanal-sinif.md). O katman
> **tek bir sorunun** ölçme özelliklerini inceler; bu katman **bütün sınavın**
> bir sınıfta ne sonuç vereceğini kestirir.

## Problem

Eğitmen sınavı hazırlar, yayına alır ve sonucu ilk kez kâğıtlar okunurken
görür. O noktada geri dönüş yoktur: sınav çok zorsa herkes düşmüştür, çok
kolaysa iyi öğrenciyle çok iyi öğrenci ayrışmamıştır, süre yetmemişse ölçülen
şey bilgi değil hızdır.

Bu sorular sınavdan **önce** sorulabilir. Cevaplayacak bir sınıf gerekir; biz
onu simüle ediyoruz.

## Öğrenci profili

Simüle öğrenci sabit bir karakter değil, parametreleri olan bir modeldir
([`lib/student-profiles.ts`](../lib/student-profiles.ts)):

| Parametre | Anlamı |
| --- | --- |
| `ability` | Kazanımı bilme düzeyi (0-1) |
| `subjectAbility` | Ders bazında ezme — "matematikte iyi, fizikte zayıf" |
| `diligence` | Dikkat (1 titiz, 0 aceleci) |
| `misconception` | Taşıdığı kavram yanılgısı |
| `group` | Ayırt edicilik hesabında üst / alt / nötr |

Soru kalitesi panelinin beş zıt profili bu modelin **hazır ayarı**dır. Sayılar
modele doğrudan gitmez; `describeProfile()` bunları davranış tarifine çevirir —
"ability 0.35" hiçbir şey anlatmaz, "ön bilgisi eksik, anahtar kelimelere
tutunarak tahmin yürütür" davranışı doğrudan tarif eder.

## Kadro üç yoldan kurulur

**Hazır kadro.** Güçlüden zorlanana beş zıt profil. Belirli bir sınıfı
hedeflemeden "sınav genel olarak nasıl işliyor" sorusuna hızlı cevap.

**Elle.** Eğitmen sınıfını tarif eder: her profil için düzey, dikkat, kaç
öğrenci. Çok dersli sınavda ders bazında düzey verilebilir.

**Dijital ikiz.** Gerçek bir sınıfın geçmiş sonuçlarından türetilir. Öğrenciler
başarıya göre sıralanıp yetkinlik dilimlerine bölünür; her dilim bir
temsilciyle ve dilimdeki öğrenci sayısı kadar **ağırlıkla** canlandırılır.

### Neden ağırlık?

25 kişilik sınıfı 25 agent'la simüle etmek 25 kat maliyet demek — ve gereksiz,
çünkü amaç tek tek öğrencileri değil **dağılımı** kestirmek. Beş temsilci,
ağırlıkları toplandığında 25 kişilik sınıfın dağılımını verir. Bütün
istatistikler ağırlıklı hesaplanır.

### Kişisel veri

İkiz kurulurken öğrenci adı, e-postası veya kimliği **modele gitmez**. Yalnızca
sayılar (ortalama, ders bazında ortalama, boş bırakma oranı) toplanır; üretilen
profiller "En üst %20", "En alt %20" gibi anonim adlar taşır. Ad göndermenin
simülasyona faydası yok, riski gerçek.

Puan kaynağı yalnızca **eğitmen onaylı** cevaplardır — `outcome-analysis.ts`
ile aynı kural.

## Çağrı düzeni

Profil başına sınav, soru başına değil:

| | Çağrı sayısı |
| --- | --- |
| Soru başına (kadro her soruyu ayrı çözer) | soru sayısı kadar |
| **Profil başına (seçilen)** | profil × parça |

Öğrenci sınavı tek oturuşta çözer; bu hem daha ucuz hem daha gerçekçi. Sorular
10'arlı parçalara bölünür (uzun çıktıda model kayıyor), parçalar sınırlı
paralellikle (4) işlenir. Açık uçlu sorular için soru başına tek bir toplu
rubrik puanlaması yapılır.

Cevap anahtarı ve rubrik **çözüm çağrılarına verilmez**.

Üst sınırlar: 30 soru, 8 profil.

## Rapor

| Metrik | Ne söyler |
| --- | --- |
| Puan dağılımı | Ortalama, ortanca, sapma, geçme oranı, 20'lik dilimler |
| Ayrışma | Üst grup − alt grup farkı; sınav sınıfı ayırıyor mu |
| Soru bazında | Başarı oranı, ayırt edicilik, en çok seçilen yanlış şık |
| Kazanım kırılımı | Hangi kazanımda toplu düşüş var (en zayıf üstte) |
| Süre uyumu | En yavaş dilim sınav süresine sığıyor mu |

Sınav düzeyi uyarılar: `sinav_cok_zor`, `sinav_cok_kolay`, `ayrisma_yok`,
`sure_yetersiz`, `sure_fazla`, `riskli_soru_yogun`.

### Süre modeli

Modele "bu soru kaç dakika sürer" diye sormuyoruz — dil modeli süreyi ölçmez,
tahmin eder ve tahmini bağlamdan bağımsız kayar. Bunun yerine gözlenebilir iki
şeyden hesaplanıyor: metin uzunluğu (130 kelime/dakika) ve soru tipi/zorluğu;
sonra profilin hızına göre ölçekleniyor. Sayılar `DURATION_MODEL` sabitinde
açıkça duruyor.

## Neyin güvenilir olduğu

Dil modelinin verdiği **mutlak puan tahmini güvenilir değildir** — 68 mi 74 mü
olacağını bilemez. Güvenilir olan **sıralama ve ayrışma**dır: hangi soru daha
zor, sınav sınıfı ayırıyor mu, hangi kazanımda toplu düşüş var.

Panel bu yüzden mutlak ortalamayı tek başına büyük puntoyla göstermez;
dağılım, ayrışma ve soru sıralaması hep yanındadır ve altta bunu açıkça
söyleyen bir not durur.

## Kalibrasyon — özelliğin kendi doğruluğunu ölçmesi

Bir tahmin, tutup tutmadığı ölçülmediği sürece güvenilir de güvenilmez de
sayılamaz. Bu yüzden her kestirim `exam_simulations` tablosuna **kaydedilir**
(migration: `supabase/migrations/BEKLEYEN-1-sinav-kestirimi.sql`). Sınav
gerçekten yapılıp puanlar onaylandığında tahmin, gerçek ortalamayla yan yana
konur.

Gerçek ortalama **tahminle aynı formülle** hesaplanır: soru puanına göre
ağırlıklandırılmış öğrenci puanlarının ortalaması. Başka türlü hesaplamak iki
sayıyı kıyaslanamaz kılardı.

| Sayı | Ne söyler |
| --- | --- |
| Ortalama sapma (MAE) | Tahmin ne kadar isabetli |
| Yönelim (bias) | Hangi yöne sapıyor — sürekli pozitifse fazla iyimser |
| 10 puan içinde | İsabetli sayılan tahminlerin oranı |
| En kötü sapma | En büyük hata |

Kurallar:

- **Her sınavdan yalnızca en son kestirim** sayılır; aynı sınavda beş kez
  çalıştırmak o sınavı beş kat ağırlıklı yapardı.
- **Onay bekleyen cevabı olan öğrenci** gerçek ortalamaya girmez; yarım
  değerlendirilmiş kâğıt ortalamayı haksız yere aşağı çeker ve simülasyonu
  haksız yere "fazla iyimser" gösterirdi.
- **Hiç ölçülmüş kestirim yoksa özet üretilmez.** Sıfır ölçümü "%0 sapma" diye
  göstermek, hiç denenmemiş bir şeyi kusursuz gibi sunmak olurdu.
- Kestirim kaydı **değiştirilemez** — tabloda `update` politikası bilerek yok.

Sapma büyük çıksa da gösterilir. Gizlemek, kullanıcının tahmine hak etmediği
bir güven duymasına yol açardı.

## Dosyalar

| Dosya | Sorumluluk |
| --- | --- |
| `lib/student-profiles.ts` | Profil modeli, hazır takım, dijital ikiz üretimi |
| `lib/exam-simulation.ts` | Ağırlıklı istatistik, uyarılar, süre modeli. **Saf** |
| `lib/exam-simulation-data.ts` | Sınav taslağı + ikiz yükleme, kestirim kaydı |
| `lib/exam-calibration.ts` | Gerçek ortalama ve sapma özeti. **Saf** |
| `lib/ai.ts` → `simulateExam()` | Model çağrıları, sınırlı paralellik, mock modu |
| `app/api/ai/simulate-exam/route.ts` | POST ucu; eğitmen kendi sınavı |
| `components/shared/exam-simulation-panel.tsx` | Kadro kurma + sonuç + kalibrasyon |
| `tests/exam-simulation.test.ts`, `tests/exam-calibration.test.ts` | Eşikler ve formüller |

Anahtar tanımlı değilse veya simülasyon modu açıksa deterministik ve gerçekçi
bir kestirim üretilir — demo anahtarsız da çalışır.
