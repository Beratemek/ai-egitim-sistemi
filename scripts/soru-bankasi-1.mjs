/**
 * Soru bankasi - 1. bolum: Robotik ve Kodlama, Yapay Zeka.
 *
 * Bicim, havuzun kirilimini birebir yansitir: DAL (DENEYAP kategorisi) ->
 * DERS -> KONU -> SORU.
 *
 * Her konu 5 soru tasir: 4 test + 1 acik uclu. Oran bilincli - havuzdan
 * uretilen sinav kagidinin cogunlugu test olmali, ama egitmenin rubrik
 * denemesi icin her konuda en az bir acik uclu soru bulunmali.
 *
 * Test sorusu:      [metin, [sik, sik, sik, sik], dogruIndex]
 * Acik uclu soru:   [metin, rubrikMetni]
 */

export const BOLUM_1 = [
  {
    subject: "Robotik ve Kodlama",
    category: "robotik_ve_kodlama",
    konular: [
      {
        konu: "Sensör Temelleri",
        sorular: [
          ["Sensör en genel tanımıyla ne yapar?", ["Fiziksel bir büyüklüğü elektriksel sinyale çevirir", "Elektrik enerjisini hareket enerjisine çevirir", "Veriyi kalıcı olarak saklar", "Devredeki akımı sınırlar"], 0],
          ["Aşağıdakilerden hangisi bir aktüatördür, sensör değildir?", ["LDR", "Servo motor", "Termistör", "Ultrasonik alıcı"], 1],
          ["Analog bir sensörün çıkışı için doğru olan nedir?", ["Yalnızca 0 ve 1 değerlerini üretir", "Belirli bir aralıkta sürekli değer üretir", "Her zaman sabit gerilim verir", "Yalnızca dijital pinlere bağlanır"], 1],
          ["Bir sensörün 'çözünürlüğü' neyi ifade eder?", ["Ölçebildiği en küçük değişim miktarını", "Çalışabileceği maksimum sıcaklığı", "Tükettiği akım miktarını", "Kablo uzunluğunu"], 0],
          ["Bir sensörün 'hassasiyet' ile 'doğruluk' kavramları arasındaki farkı açıklayın ve her birine birer örnek verin.", "Hassasiyet: aynı ölçümü tekrarladığında sonuçların birbirine yakınlığı (2 puan). Doğruluk: ölçülen değerin gerçek değere yakınlığı (2 puan). Bir sensörün hassas ama doğru olmayabileceğini örnekle açıklama (3 puan). Toplam 7 puan."],
        ],
      },
      {
        konu: "Ultrasonik Mesafe Sensörü",
        sorular: [
          ["HC-SR04 ultrasonik sensör mesafeyi nasıl ölçer?", ["Ses dalgasının gidiş-dönüş süresini ölçerek", "Işığın yansıma açısını ölçerek", "Manyetik alan değişimini ölçerek", "Ortamın sıcaklığını ölçerek"], 0],
          ["Sesin havadaki hızı yaklaşık 340 m/s ise, yankının 20 ms sonra dönmesi engelin kaç metre uzakta olduğunu gösterir?", ["6.8 m", "3.4 m", "1.7 m", "0.85 m"], 1],
          ["Ultrasonik sensör hangi durumda hatalı ölçüm verme eğilimindedir?", ["Düz ve sert bir duvara dik bakarken", "Yumuşak, ses emici bir yüzeye bakarken", "Oda sıcaklığında çalışırken", "Engel 1 metre uzaktayken"], 1],
          ["HC-SR04'te TRIG pininin görevi nedir?", ["Ses dalgasının gönderilmesini tetiklemek", "Dönen yankıyı algılamak", "Sensöre güç vermek", "Mesafeyi doğrudan santimetre olarak vermek"], 0],
          ["Bir robotun ultrasonik sensörle engelden kaçması isteniyor. Ölçüm hatalarına karşı hangi önlemleri alırsınız? En az üç öneri yazın.", "Birden fazla ölçümün ortalamasını/medyanını alma (2 puan). Ölçümler arasında yeterli bekleme koyarak yankı karışmasını önleme (2 puan). Eşik değeri ve histerezis kullanma (2 puan). Birden fazla sensör veya farklı sensör tipiyle doğrulama (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "LDR ve Işık Sensörleri",
        sorular: [
          ["LDR'nin direnci ışık şiddeti arttığında nasıl değişir?", ["Azalır", "Artar", "Değişmez", "Önce artar sonra azalır"], 0],
          ["LDR bir mikrodenetleyiciye genellikle hangi devreyle bağlanır?", ["Gerilim bölücü", "Yükseltici", "H-köprüsü", "Doğrultucu"], 0],
          ["LDR'nin çıkışı hangi pin tipiyle okunmalıdır?", ["Analog giriş", "Dijital çıkış", "PWM çıkışı", "Seri port"], 0],
          ["Aşağıdakilerden hangisi LDR'nin zayıf yönüdür?", ["Ucuz olması", "Tepki süresinin görece yavaş olması", "Kolay bulunması", "Basit devreyle çalışması"], 1],
          ["Bir sokak lambasının karanlıkta otomatik yanmasını sağlayan sistemi LDR ile nasıl kurarsınız? Devre ve yazılım mantığını anlatın.", "LDR'nin gerilim bölücüyle analog girişe bağlanması (2 puan). Eşik değeri belirleme (2 puan). Eşiğin altına düşünce röle/LED sürme (2 puan). Titremeyi önlemek için histerezis veya gecikme kullanma (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Mikrodenetleyicide Karar Verme",
        sorular: [
          ["Bir eşik değeri (threshold) ne işe yarar?", ["Sürekli veriyi ikili bir karara dönüştürür", "Sensörü kalibre eder", "Devredeki gürültüyü fiziksel olarak yok eder", "Pin numarasını belirler"], 0],
          ["Sensör değeri eşiğin çevresinde salınırken çıkışın sürekli açılıp kapanmasını engellemek için ne kullanılır?", ["Histerezis", "PWM", "Kesme (interrupt)", "Seri haberleşme"], 0],
          ["if (mesafe < 20) komutunda 20 değeri neyi temsil eder?", ["Eşik değerini", "Pin numarasını", "Gecikme süresini", "Sensörün çözünürlüğünü"], 0],
          ["Bir robotun hem engelden kaçıp hem çizgi izlemesi isteniyor. Bu, hangi programlama yapısını gerektirir?", ["Koşullu dallanma", "Yalnızca döngü", "Yalnızca fonksiyon tanımı", "Yalnızca dizi"], 0],
          ["Bir sıcaklık kontrol sisteminde histerezis kullanmanın nedenini ve kullanılmazsa ne olacağını açıklayın.", "Histerezisin iki farklı eşik (açma/kapama) kullandığını belirtme (3 puan). Kullanılmazsa eşik civarında hızlı açma-kapama (röle çıtırdaması) olacağını açıklama (3 puan). Somut örnek verme (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Motor Sürme ve PWM",
        sorular: [
          ["PWM ile motor hızı nasıl ayarlanır?", ["Sinyalin doluluk oranı (duty cycle) değiştirilerek", "Sinyalin frekansı sıfırlanarak", "Gerilim tamamen kesilerek", "Motorun sarım sayısı değiştirilerek"], 0],
          ["%25 doluluk oranına sahip bir PWM sinyali ne anlama gelir?", ["Sinyal periyodun dörtte birinde yüksek seviyededir", "Sinyal periyodun dörtte üçünde yüksek seviyededir", "Frekans dörde bölünmüştür", "Gerilim dörde katlanmıştır"], 0],
          ["DC motoru iki yönde döndürebilmek için hangi devre kullanılır?", ["H-köprüsü", "Gerilim bölücü", "Doğrultucu köprü", "RC filtre"], 0],
          ["Motor sürücü entegresi kullanmanın temel nedeni nedir?", ["Mikrodenetleyici pininin motoru sürecek akımı veremeyişi", "Motorun daha sessiz çalışması", "Kod yazımını kolaylaştırması", "Motorun ısınmasını artırması"], 0],
          ["İki tekerlekli bir robotun sağa dönmesi için motorlara nasıl bir PWM uygulanmalıdır? Farklı dönüş tiplerini karşılaştırın.", "Sağ motorun yavaşlatılması/durdurulması ile yay çizerek dönüş (3 puan). İki motorun ters yönde sürülmesiyle yerinde dönüş (3 puan). İki yöntemin kullanım farkını açıklama (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Çizgi İzleyen Robot",
        sorular: [
          ["Kızılötesi çizgi sensörü siyah zemin üzerinde ne ölçer?", ["Az yansıyan ışık nedeniyle düşük yansıma değeri", "Yüksek yansıma değeri", "Sabit sıcaklık", "Manyetik alan"], 0],
          ["Çizgi izleyen robotta iki sensör de çizgiyi görüyorsa robot ne yapmalıdır?", ["Düz devam etmeli", "Sola keskin dönmeli", "Sağa keskin dönmeli", "Durmalı"], 0],
          ["Çizgi izleyen bir robotta oransal (P) kontrolün amacı nedir?", ["Hatanın büyüklüğüyle orantılı düzeltme uygulamak", "Motorları tam güçte çalıştırmak", "Sensör sayısını azaltmak", "Bataryayı korumak"], 0],
          ["Robotun çizgiden çıkıp geri bulamamasının yaygın nedeni nedir?", ["Sensörlerin kalibre edilmemiş olması", "Motorların çok yavaş olması", "Bataryanın tam dolu olması", "Kodun yorum satırı içermesi"], 0],
          ["Çizgi izleyen bir robotun keskin virajlarda çizgiyi kaybetmesini önlemek için neler yaparsınız?", "Sensör sayısını artırma veya sensörleri daha geniş yerleştirme (2 puan). Hız azaltma (2 puan). Son görülen yöne göre arama davranışı ekleme (3 puan). PID/oransal kontrol kullanma (2 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Dijital ve Analog Sinyaller",
        sorular: [
          ["Dijital sinyalin analog sinyalden temel farkı nedir?", ["Yalnızca belirli ayrık değerler alması", "Daha yüksek gerilimde çalışması", "Kablosuz iletilebilmesi", "Daha hızlı olması"], 0],
          ["10 bitlik bir ADC kaç farklı seviye ayırt edebilir?", ["1024", "100", "512", "256"], 0],
          ["ADC kısaltması neyi ifade eder?", ["Analog-Dijital Dönüştürücü", "Otomatik Veri Kontrolü", "Aktif Direnç Devresi", "Adres Veri Kanalı"], 0],
          ["5 V referanslı 10 bit ADC'de 512 okuması yaklaşık kaç volttur?", ["2.5 V", "5 V", "1.2 V", "0.5 V"], 0],
          ["Bir analog sensörün verisini mikrodenetleyicide okurken gürültüyü azaltmak için hangi yöntemleri kullanırsınız?", "Ortalama/medyan filtresi uygulama (3 puan). Donanımsal RC filtre ekleme (2 puan). Örnekleme sayısını artırma (2 puan). Kablo kısaltma ve ekranlama (2 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Robot Kinematiği",
        sorular: [
          ["Diferansiyel sürüşlü bir robotta yön değişimi nasıl sağlanır?", ["İki tekerleğin hız farkıyla", "Ön tekerleğin çevrilmesiyle", "Gövdenin eğilmesiyle", "Ağırlık merkezinin kaydırılmasıyla"], 0],
          ["Enkoder bir robotta ne ölçer?", ["Tekerlek dönüş miktarını", "Ortam sıcaklığını", "Batarya voltajını", "Ses şiddetini"], 0],
          ["Odometri ne demektir?", ["Tekerlek dönüşlerinden konum tahmini yapmak", "Mesafeyi ultrasonik ölçmek", "Motoru PWM ile sürmek", "Kamerayla nesne tanımak"], 0],
          ["Odometrinin zamanla hata biriktirmesinin temel nedeni nedir?", ["Tekerlek kayması ve ölçüm hatalarının toplanması", "Bataryanın dolması", "Kodun uzun olması", "Sensörün dijital olması"], 0],
          ["Odometri hatasını azaltmak için hangi ek sensörler kullanılabilir? Her birinin katkısını yazın.", "IMU/jiroskop ile açı düzeltmesi (3 puan). Ultrasonik/LIDAR ile duvar referansı (3 puan). Kamera ile işaretçi tanıma (2 puan). Sensör füzyonundan söz etme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Robotik Güvenlik",
        sorular: [
          ["Bir robot projesinde acil durdurma düğmesinin görevi nedir?", ["Gücü donanımsal olarak kesmek", "Kodu yeniden başlatmak", "Motor hızını yavaşlatmak", "Sensörleri kalibre etmek"], 0],
          ["Motor beslemesi ile mikrodenetleyici beslemesinin ayrılmasının nedeni nedir?", ["Motor kaynaklı gerilim düşmelerinin denetleyiciyi etkilememesi", "Kabloların kısalması", "Motorun hızlanması", "Kodun küçülmesi"], 0],
          ["Aşağıdakilerden hangisi robot çalışırken alınması gereken bir güvenlik önlemidir?", ["Hareketli parçalardan uzak durmak", "Bataryayı kısa devre yapmak", "Motor sürücüyü soğutmasız kullanmak", "Kabloları çıplak bırakmak"], 0],
          ["Lityum pil kullanırken en kritik risk nedir?", ["Aşırı şarj/deşarjda yangın riski", "Ağır olması", "Pahalı olması", "Yavaş şarj olması"], 0],
          ["Okul laboratuvarında robot çalıştırırken uyulması gereken güvenlik kurallarını maddeler halinde yazın.", "Acil durdurma bulundurma (2 puan). Robotu sabit ve sınırlı bir alanda test etme (2 puan). Pil güvenliği ve şarj kuralları (2 puan). Kablo düzeni ve kısa devre önlemi (2 puan). Gözlük/uzak durma gibi kişisel önlemler (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Algoritma ve Akış Şeması",
        sorular: [
          ["Akış şemasında eşkenar dörtgen (baklava) şekli neyi gösterir?", ["Karar noktasını", "Başlangıcı", "İşlemi", "Çıkışı"], 0],
          ["Bir algoritmanın 'sonlu olması' ne demektir?", ["Belirli sayıda adımda bitmesi", "Az bellek kullanması", "Tek satır olması", "Hatasız olması"], 0],
          ["Döngü kullanmanın temel amacı nedir?", ["Tekrarlanan işlemleri tek yerde toplamak", "Programı yavaşlatmak", "Bellek kullanımını artırmak", "Değişken sayısını çoğaltmak"], 0],
          ["Sonsuz döngüye girmiş bir robot programında ilk kontrol edilmesi gereken nedir?", ["Döngüden çıkış koşulunun sağlanıp sağlanmadığı", "Kabloların rengi", "Bataryanın markası", "Motorun ağırlığı"], 0],
          ["Bir robotun 'engel görürse dur, 2 saniye bekle, sağa dön, devam et' davranışını algoritma adımları halinde yazın.", "Adımların sıralı ve net yazılması (3 puan). Koşul ifadesinin doğru kurulması (3 puan). Döngü/tekrar mantığının belirtilmesi (2 puan). Başlangıç ve bitiş koşulu (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },

  {
    subject: "Yapay Zekâ",
    category: "yapay_zeka",
    konular: [
      {
        konu: "Yapay Zekâya Giriş",
        sorular: [
          ["Yapay zekâ en genel tanımıyla nedir?", ["İnsana özgü bilişsel işleri yapabilen sistemler", "Yalnızca robot üretimi", "İnternet üzerinden veri saklama", "Bilgisayarların hızlandırılması"], 0],
          ["Makine öğrenmesi yapay zekânın neyidir?", ["Bir alt dalıdır", "Üst kümesidir", "Alternatifidir", "İlgisiz bir alandır"], 0],
          ["Kural tabanlı sistemlerle makine öğrenmesinin farkı nedir?", ["Makine öğrenmesi kuralları veriden çıkarır", "Kural tabanlı sistem veri kullanmaz denemez", "İkisi de aynıdır", "Makine öğrenmesi daha az veri ister"], 0],
          ["Aşağıdakilerden hangisi dar (zayıf) yapay zekâya örnektir?", ["Yüz tanıma uygulaması", "İnsan gibi her işi yapabilen sistem", "Bilinçli makine", "Kendi amacını belirleyen sistem"], 0],
          ["Yapay zekânın günlük hayatta kullanıldığı üç alanı, her biri için somut örnek vererek açıklayın.", "Üç farklı alan belirtme (3 puan). Her alan için somut ve doğru örnek (3 puan). Yapay zekânın o örnekte hangi işi yaptığını açıklama (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Veri ve Veri Seti",
        sorular: [
          ["Etiketli veri ne demektir?", ["Her örneğin doğru çıktısının birlikte verilmesi", "Verinin sıkıştırılmış olması", "Verinin şifreli olması", "Verinin görsel olması"], 0],
          ["Eğitim ve test kümesinin ayrılmasının amacı nedir?", ["Modelin görmediği veride başarısını ölçmek", "Veriyi küçültmek", "Eğitimi hızlandırmak", "Etiket sayısını azaltmak"], 0],
          ["Dengesiz veri seti hangi soruna yol açar?", ["Modelin çoğunluk sınıfa yanlı olması", "Eğitimin hiç bitmemesi", "Verinin bozulması", "Test kümesinin gereksizleşmesi"], 0],
          ["Veri temizleme sürecinde aşağıdakilerden hangisi yapılır?", ["Eksik ve hatalı kayıtların düzeltilmesi", "Model katmanı ekleme", "Öğrenme oranı seçme", "GPU seçimi"], 0],
          ["Bir okul için 'kantinde en çok satan ürünü tahmin eden' bir model kuracaksınız. Hangi verileri toplarsınız ve neden?", "En az üç anlamlı özellik belirtme, örn. saat, gün, hava durumu, fiyat (3 puan). Etiketin ne olacağını tanımlama (2 puan). Verinin nasıl toplanacağını açıklama (2 puan). Gizlilik/etik konusuna değinme (2 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Denetimli Öğrenme",
        sorular: [
          ["Denetimli öğrenmenin temel özelliği nedir?", ["Girdi ve doğru çıktı çiftleriyle eğitilmesi", "Etiketsiz veriyle çalışması", "Ödül sinyaliyle öğrenmesi", "Hiç veri kullanmaması"], 0],
          ["Sınıflandırma ile regresyon arasındaki fark nedir?", ["Sınıflandırma kategori, regresyon sayısal değer tahmin eder", "Regresyon kategori tahmin eder", "İkisi aynıdır", "Sınıflandırma etiketsizdir"], 0],
          ["Bir e-postanın spam olup olmadığını tahmin etmek hangi problemdir?", ["Sınıflandırma", "Regresyon", "Kümeleme", "Boyut indirgeme"], 0],
          ["Bir evin fiyatını tahmin etmek hangi problemdir?", ["Regresyon", "Sınıflandırma", "Kümeleme", "Pekiştirmeli öğrenme"], 0],
          ["Denetimli öğrenmede 'aşırı öğrenme' (overfitting) nedir ve nasıl anlaşılır? Önlemlerini yazın.", "Modelin eğitim verisini ezberleyip yeni veride başarısız olması (3 puan). Eğitim başarısı yüksek, test başarısı düşük olmasından anlaşılması (2 puan). En az iki önlem: veri artırma, düzenlileştirme, basit model, erken durdurma (4 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Denetimsiz Öğrenme",
        sorular: [
          ["Denetimsiz öğrenmede veri nasıldır?", ["Etiketsizdir", "Her zaman etiketlidir", "Yalnızca sayısaldır", "Yalnızca görseldir"], 0],
          ["K-ortalamalar (k-means) algoritması ne yapar?", ["Veriyi k adet kümeye ayırır", "Etiketleri tahmin eder", "Veriyi şifreler", "Modeli test eder"], 0],
          ["Kümeleme hangi durumda kullanılır?", ["Verideki doğal grupları keşfetmek için", "Doğru etiketi bilinen tahmin için", "Ödül maksimizasyonu için", "Veri silmek için"], 0],
          ["Boyut indirgemenin amacı nedir?", ["Özellik sayısını azaltarak veriyi sadeleştirmek", "Örnek sayısını artırmak", "Etiket eklemek", "Modeli büyütmek"], 0],
          ["Bir mağaza müşterilerini kümelemek istiyor. Hangi özellikleri kullanırsınız ve sonucu nasıl yorumlarsınız?", "En az üç anlamlı özellik (3 puan). Kümeleme algoritmasının seçimi ve gerekçesi (2 puan). Kümelerin iş açısından nasıl yorumlanacağı (3 puan). Etik/gizlilik notu (1 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Yapay Sinir Ağları",
        sorular: [
          ["Yapay sinir ağında 'nöron' ne yapar?", ["Girdilerin ağırlıklı toplamını alıp aktivasyondan geçirir", "Veriyi diskte saklar", "Etiketleri üretir", "Ağı eğitir"], 0],
          ["Aktivasyon fonksiyonunun görevi nedir?", ["Ağa doğrusal olmayanlık kazandırmak", "Veriyi normalleştirmek", "Ağırlıkları silmek", "Katman sayısını belirlemek"], 0],
          ["Derin öğrenme terimi neyi ifade eder?", ["Çok katmanlı sinir ağlarıyla öğrenmeyi", "Çok fazla veri toplamayı", "Uzun süre eğitmeyi", "Büyük ekranda çalışmayı"], 0],
          ["Geri yayılım (backpropagation) ne için kullanılır?", ["Hatayı geriye taşıyarak ağırlıkları güncellemek", "Veriyi bölmek", "Katman eklemek", "Etiket üretmek"], 0],
          ["Bir sinir ağının 'öğrenme oranı' çok büyük ya da çok küçük seçilirse ne olur? Açıklayın.", "Çok büyükse: kayıp fonksiyonunda salınım, yakınsayamama (3 puan). Çok küçükse: çok yavaş öğrenme, yerel minimumda takılma (3 puan). Uygun seçim için deneme/planlama önerisi (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Model Değerlendirme",
        sorular: [
          ["Doğruluk (accuracy) nasıl hesaplanır?", ["Doğru tahmin sayısı / toplam tahmin sayısı", "Doğru tahmin / yanlış tahmin", "Toplam veri / sınıf sayısı", "Kayıp değeri / örnek sayısı"], 0],
          ["Dengesiz veri setinde doğruluk neden yanıltıcıdır?", ["Çoğunluk sınıfı tahmin ederek yüksek çıkabilir", "Her zaman düşük çıkar", "Hesaplanamaz", "Test kümesi gerekmez"], 0],
          ["Karmaşıklık matrisinde 'yanlış pozitif' ne demektir?", ["Olumsuz örneğin olumlu tahmin edilmesi", "Olumlu örneğin olumsuz tahmin edilmesi", "Doğru tahmin", "Eksik veri"], 0],
          ["Duyarlılık (recall) neyi ölçer?", ["Gerçek olumluların ne kadarının yakalandığını", "Tahminlerin ne kadarının doğru olduğunu", "Modelin hızını", "Veri miktarını"], 0],
          ["Bir hastalık teşhis modelinde yanlış negatif ile yanlış pozitifin sonuçlarını karşılaştırın. Hangi metriği önceliklendirirsiniz?", "Yanlış negatifin hastanın tedavisiz kalması demek olduğunu belirtme (3 puan). Yanlış pozitifin gereksiz tetkik/kaygı demek olduğunu belirtme (2 puan). Duyarlılığın önceliklendirilmesi ve gerekçesi (3 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Doğal Dil İşleme",
        sorular: [
          ["Doğal dil işleme neyle ilgilenir?", ["Bilgisayarların insan dilini işlemesiyle", "Görüntü tanımayla", "Robot hareketiyle", "Devre tasarımıyla"], 0],
          ["Tokenizasyon ne demektir?", ["Metni anlamlı parçalara ayırmak", "Metni şifrelemek", "Metni çevirmek", "Metni sıkıştırmak"], 0],
          ["Duygu analizi hangi problemdir?", ["Metin sınıflandırma", "Regresyon", "Kümeleme", "Boyut indirgeme"], 0],
          ["Kelime gömme (word embedding) neyi sağlar?", ["Kelimeleri anlamsal yakınlığı koruyan sayısal vektörlere çevirmeyi", "Kelimeleri alfabetik sıralamayı", "Metni kısaltmayı", "Yazım hatası düzeltmeyi"], 0],
          ["Bir okul geri bildirim formundaki yorumları otomatik sınıflandırmak istiyorsunuz. Adım adım nasıl bir sistem kurarsınız?", "Veri toplama ve etiketleme (2 puan). Ön işleme: temizleme, tokenizasyon (2 puan). Model seçimi ve eğitim (2 puan). Değerlendirme metriği (2 puan). Gizlilik ve önyargı riskine değinme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Görüntü İşleme",
        sorular: [
          ["Dijital bir görüntü bilgisayarda nasıl temsil edilir?", ["Piksel değerlerinden oluşan matris olarak", "Metin dizisi olarak", "Ses dalgası olarak", "Vektör çizim olarak"], 0],
          ["Gri tonlamalı bir görüntüde her piksel kaç kanal taşır?", ["1", "3", "4", "8"], 0],
          ["Evrişimli sinir ağları (CNN) en çok hangi alanda kullanılır?", ["Görüntü işleme", "Ses sıkıştırma", "Veri tabanı yönetimi", "Ağ yönlendirme"], 0],
          ["Kenar algılama filtresi ne yapar?", ["Yoğunluk değişiminin keskin olduğu bölgeleri belirginleştirir", "Görüntüyü bulanıklaştırır", "Renkleri tersine çevirir", "Görüntüyü döndürür"], 0],
          ["Bir okul girişinde maske takan/takmayan kişileri ayırt eden sistem kurulacak. Teknik adımları ve etik riskleri yazın.", "Veri toplama ve etiketleme (2 puan). Model seçimi, örn. CNN (2 puan). Değerlendirme ve eşik belirleme (2 puan). Gizlilik, rıza ve yanlış sınıflandırma riskine değinme (4 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Yapay Zekâ Etiği",
        sorular: [
          ["Algoritmik önyargı (bias) nereden kaynaklanır?", ["Çoğunlukla eğitim verisindeki dengesizlikten", "Programlama dilinden", "Bilgisayarın hızından", "Ekran çözünürlüğünden"], 0],
          ["Bir yapay zekâ sisteminde 'açıklanabilirlik' neden önemlidir?", ["Kararın gerekçesinin denetlenebilmesi için", "Modelin hızlanması için", "Veriyi küçültmek için", "Kod satırını azaltmak için"], 0],
          ["Kişisel veri işlenirken uyulması gereken temel ilke nedir?", ["Amaçla sınırlı ve rızaya dayalı işleme", "Mümkün olduğunca çok veri toplama", "Veriyi süresiz saklama", "Veriyi herkese açma"], 0],
          ["Aşağıdakilerden hangisi yapay zekânın olumsuz kullanımına örnektir?", ["Sahte içerik üretip yanıltma", "Hastalık teşhisine destek", "Trafik optimizasyonu", "Tarımda verim tahmini"], 0],
          ["İşe alım sürecinde kullanılan bir yapay zekâ sistemi belirli bir gruba karşı önyargılı sonuçlar üretiyor. Sorunun kaynaklarını ve çözüm önerilerinizi yazın.", "Veri kaynaklı önyargıyı açıklama (3 puan). Ölçüm/etiket kaynaklı önyargıya değinme (2 puan). Çözüm: veri dengeleme, denetim, insan onayı, şeffaflık (4 puan). Sorumluluk sorusuna değinme (1 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Üretken Yapay Zekâ",
        sorular: [
          ["Üretken yapay zekâ modelleri ne yapar?", ["Öğrendiği desenlere benzer yeni içerik üretir", "Yalnızca sınıflandırma yapar", "Yalnızca veri siler", "Yalnızca sayı sayar"], 0],
          ["Büyük dil modellerinde 'halüsinasyon' ne demektir?", ["Modelin gerçek olmayan bilgiyi güvenle üretmesi", "Modelin yavaşlaması", "Verinin bozulması", "Eğitimin durması"], 0],
          ["Bir dil modelinden daha iyi sonuç almak için ne yapılır?", ["Görevi açık ve bağlamlı biçimde tarif etmek", "Daha kısa yazmak", "Büyük harf kullanmak", "Soruyu tekrarlamak"], 0],
          ["Üretken modellerin ürettiği içerik kullanılırken en önemli adım nedir?", ["Doğruluğunu kaynaklardan denetlemek", "Doğrudan yayımlamak", "Uzunluğunu artırmak", "Biçimini değiştirmek"], 0],
          ["Bir öğrenci ödevini tamamen üretken yapay zekâya yaptırıyor. Bunun öğrenmeye etkisini ve nasıl bir kullanım sınırının doğru olacağını tartışın.", "Öğrenme açısından olumsuz etkileri açıklama (3 puan). Yararlı kullanım biçimlerini belirtme, örn. fikir üretme, kontrol (3 puan). Akademik dürüstlük kuralına değinme (2 puan). Somut sınır önerisi (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },
];
