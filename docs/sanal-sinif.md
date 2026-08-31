# Sanal Sınıf - soru kalitesini öğrenciye ulaşmadan ölçmek

## Problem

Üretilen bir sorunun iyi olup olmadığı, klasik yolla ancak öğrenciler onu
çözdükten sonra anlaşılır. Ölçme-değerlendirmede buna **pilot uygulama** denir:
soru bir gruba uygulanır, sonra madde analizi yapılır - madde güçlüğü (p),
ayırt edicilik, çeldirici dağılımı. Sorunlu maddeler ancak bu adımdan sonra
ayıklanır.

Pilot uygulama gerçek öğrenci ve gerçek zaman ister. Bir kazanım için beş soru
üreten içerik uzmanı bunu asla yapamaz. Sonuç: yapay zekânın ürettiği sorular
**hiç ölçülmeden** havuza girer, hatalar ilk kez gerçek sınavda ortaya çıkar ve
bedeli itiraz, puan iptali ve güven kaybı olur.

## Yaklaşım

Pilot uygulamayı simüle ediyoruz. Beş farklı bilişsel profildeki öğrenci
agent'ı soruyu **cevap anahtarını görmeden** çözüyor; madde analizi metrikleri
onların cevaplarından hesaplanıyor.

| Profil | Grup | Neyi ölçer |
| --- | --- | --- |
| Güçlü öğrenci | üst | Anahtar doğru mu? Bu öğrenci yanılıyorsa soruda sorun var. |
| Ortalama öğrenci | üst | Sorunun kazanım kapsamında kalıp kalmadığı |
| Zorlanan öğrenci | alt | Okunabilirlik, soru kökünün açıklığı |
| Kavram yanılgılı öğrenci | alt | Çeldiriciler gerçek yanılgıları karşılıyor mu? |
| Aceleci öğrenci | nötr | Tuzaklı ve muğlak ifadeler |

Bunlara ek olarak, konuyu **hiç bilmeyen** bir "test kurnazı" sondası soruyu
yalnızca şıkların biçimine bakarak çözmeye çalışır.

### Kritik tasarım kararı: anahtar modele verilmez

Cevap anahtarı ve rubrik, simülasyona **hiçbir biçimde** girmez. Verilseydi
güçlü öğrenci personası anahtarı kopyalar, p değeri her soruda 1,0 çıkar ve
ölçüm hiçbir şey söylemezdi. Anahtar yalnızca cevaplar geldikten **sonra**,
`lib/student-agents.ts` içindeki saf hesap katmanında karşılaştırmaya girer.

Bu yüzden "güçlü öğrencinin yanlış yapması" gerçek bir sinyaldir: ya anahtar
hatalıdır ya da soru birden fazla doğru cevaba açıktır.

### Neden ayrı bir ipucu sondası?

Test kurnazı sondası ayrı bir model çağrısıdır. Aynı çağrıda sorulsaydı model
soruyu zaten güçlü öğrenci olarak çözmüş olur, "bilmeden tahmin" onun kopyası
çıkardı. Sondaya ders, konu ve kazanım da verilmez.

Sızıntı sayılması için **üç şart** birden aranır: tahmin doğruyu tutturacak,
sonda kendinden emin olacak ve dayandığı biçimsel ipucunu (en uzun şık,
dilbilgisi uyumu, "hepsi/hiçbiri", "asla/her zaman") **adıyla** söyleyebilecek.
Gerekçe şart koşulmasaydı model konuyu zaten bildiği için her kolay soru
"ipucu sızıyor" diye işaretlenirdi.

## Üretilen metrikler

| Metrik | Nasıl hesaplanır |
| --- | --- |
| **p değeri** | Doğru cevaplayan profillerin oranı (0-1). Açık uçluda rubrik puanlarının ortalaması. |
| **Ayırt edicilik** | Üst grup başarısı − alt grup başarısı (−1..1). Negatif değer maddenin ters çalıştığını gösterir. |
| **Çeldirici dağılımı** | Hangi şıkkı hangi profil seçti. |
| **Belirsizlik** | Soruyu belirsiz bulan profil sayısı. |
| **İpucu sızıntısı** | Konuyu bilmeyen sonda doğruyu tutturdu mu, hangi biçimsel ipucuyla? |

Metrikler `lib/question-analytics.ts` ile **aynı kavramları** kullanır. Bu
bilinçli: soru gerçek sınavda kullanıldığında simülasyonun tahmini ile gerçek
sonuç yan yana konabilir.

## Bulgular ve kalite skoru

Metriklerden deterministik kurallarla bulgu üretilir - bu adımda model yoktur,
dolayısıyla eşikler ve kurallar birim testiyle doğrulanır
(`tests/student-agents.test.ts`).

| Bulgu | Önem |
| --- | --- |
| Cevap anahtarı şüpheli | yüksek |
| Şıklar ipucu sızdırıyor | yüksek |
| Soru ifadesi belirsiz | yüksek / orta |
| Madde ters çalışıyor | yüksek |
| Ayırt ediciliği düşük | orta |
| Soru çok kolay / çok zor | orta |
| Çeldirici doğru cevaptan güçlü | orta |
| Rubrik ayrıştırmıyor | orta |
| İşlevsiz çeldirici | orta / düşük |
| Zorluk etiketi tutmuyor | düşük |

Kalite skoru 100'den başlar; her bulgu ağırlığınca düşer (yüksek 30, orta 15,
düşük 5). 80+ "havuza hazır", 60-79 "gözden geçirin", altı "revizyon gerekli".

## Kapalı döngü: tespit → düzeltme → yeniden ölçüm

Her bulgu, modele verilebilecek bir `repairInstruction` taşır.
`buildRepairInstruction()` yüksek ve orta öncelikli bulguları tek bir revizyon
talimatına çevirir; talimat var olan `/api/ai/revise-question` ucuna gider ve
düzeltilen soru **yeniden** pilota sokulur. İki skor yan yana gösterilir,
hangisinin kullanılacağına içerik uzmanı karar verir.

Düşük öncelikli bulgular talimata girmez: küçük bir uyarı için soruyu baştan
yazdırmak, çalışan bir taslağı bozma riski taşır.

## Maliyet

| Soru tipi | Model çağrısı |
| --- | --- |
| Çoktan seçmeli | 2 (sınıf + ipucu sondası, paralel) |
| Açık uçlu | 2 (sınıf, ardından toplu rubrik puanlaması) |
| Onarım | +3 (revizyon + yeniden ölçüm) |

Beş öğrenci tek çağrıda simüle edilir; beş ayrı çağrı hem beş katı pahalı hem
beş katı yavaş olurdu. Açık uçlu cevaplar da tek çağrıda puanlanır: önemli olan
mutlak puan değil, üst ve alt grubun ayrışıp ayrışmadığıdır.

Pilot **kendiliğinden çalışmaz**; kullanıcı başlatır. Diyalog açılınca otomatik
başlasaydı, kartı merak edip açan her kullanıcı farkında olmadan kota harcardı.

## Dosyalar

| Dosya | Sorumluluk |
| --- | --- |
| `lib/student-agents.ts` | Persona tanımları, metrik ve bulgu hesabı. **Saf** - ağ çağrısı yok, birim testli. |
| `lib/ai.ts` → `runVirtualClass()` | Model çağrıları, mock modu, anahtar çözümü. |
| `app/api/ai/virtual-class/route.ts` | POST ucu; içerik uzmanı ve eğitmen erişir. |
| `components/shared/virtual-class-dialog.tsx` | Panel: skor, bulgular, sınıfın cevapları, çeldirici dağılımı, onarım. |
| `tests/student-agents.test.ts` | Eşiklerin ve bulgu kurallarının testleri. |

Anahtar tanımlı değilse veya simülasyon modu açıksa `mockVirtualClass()`
deterministik ve gerçekçi bir rapor üretir - demo anahtarsız da çalışır.
