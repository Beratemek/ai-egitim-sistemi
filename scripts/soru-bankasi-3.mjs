/**
 * Soru bankasi - 3. bolum: Yazilim Teknolojileri, Enerji Teknolojileri.
 *
 * Bicim icin bkz. soru-bankasi-1.mjs
 */

export const BOLUM_3 = [
  {
    subject: "Yazılım Teknolojileri",
    category: "yazilim_teknolojileri",
    konular: [
      {
        konu: "Değişkenler ve Veri Tipleri",
        sorular: [
          ["Değişken en genel tanımıyla nedir?", ["Bellekte adlandırılmış bir veri alanı", "Bir fonksiyon çağrısı", "Bir döngü türü", "Bir hata mesajı"], 0],
          ["Tam sayı ile ondalıklı sayı tipini ayırmanın temel nedeni nedir?", ["Bellek kullanımı ve hassasiyetin farklı olması", "Yazımının kolay olması", "Renklerinin farklı olması", "Dil zorunluluğu"], 0],
          ["Sabit (constant) tanımlamanın avantajı nedir?", ["Değerin yanlışlıkla değiştirilmesini engellemesi", "Programı hızlandırması", "Belleği artırması", "Kodu kısaltması"], 0],
          ["Bir değişkene anlamlı isim vermenin en önemli faydası nedir?", ["Kodun sonradan okunabilir olması", "Derlemenin hızlanması", "Dosyanın küçülmesi", "Hata sayısının sıfırlanması"], 0],
          ["Aşağıdaki isimlendirmeleri değerlendirin: x, gecici, ogrenciOrtalamasi. Hangisi daha iyidir ve neden? İyi isimlendirme kurallarını yazın.", "ogrenciOrtalamasi'nın en iyi olduğunu gerekçesiyle belirtme (3 puan). Ne yaptığını anlatan, kısaltmasız isim önerisi (3 puan). Tutarlı yazım kuralına değinme (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Koşullu İfadeler",
        sorular: [
          ["if-else yapısının amacı nedir?", ["Koşula göre farklı kod bloklarını çalıştırmak", "Kodu tekrarlamak", "Fonksiyon tanımlamak", "Değişken oluşturmak"], 0],
          ["'==' ile '=' operatörlerinin farkı nedir?", ["'==' karşılaştırır, '=' atar", "'=' karşılaştırır, '==' atar", "İkisi de atar", "İkisi de karşılaştırır"], 0],
          ["Çok sayıda if-else yerine hangi yapı tercih edilebilir?", ["switch-case", "for döngüsü", "while döngüsü", "try-catch"], 0],
          ["Mantıksal 'VE' operatörü ne zaman doğru sonuç verir?", ["Her iki koşul da doğruysa", "En az biri doğruysa", "Hiçbiri doğru değilse", "Her zaman"], 0],
          ["Bir öğrencinin notuna göre harf notu veren mantığı yazın. Sınır değerlerde (tam 50, tam 85) hata yapmamak için nelere dikkat edilir?", "Koşulların doğru sırayla yazılması (3 puan). Sınır değerlerin hangi aralığa dahil olduğunun netleştirilmesi (3 puan). '>=' ve '>' farkına değinme (2 puan). Örnekle doğrulama (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Döngüler",
        sorular: [
          ["for döngüsü en çok hangi durumda tercih edilir?", ["Tekrar sayısı bilindiğinde", "Tekrar sayısı bilinmediğinde", "Hiç tekrar gerekmediğinde", "Fonksiyon tanımlarken"], 0],
          ["while döngüsünde sonsuz döngüye girmemek için ne gerekir?", ["Koşulu değiştiren bir işlem bulunması", "Döngünün kısa olması", "Değişken sayısının az olması", "Yorum satırı eklenmesi"], 0],
          ["break komutu ne yapar?", ["İçinde bulunduğu döngüyü sonlandırır", "Bir sonraki adıma geçer", "Fonksiyondan çıkar", "Programı kapatır"], 0],
          ["continue komutu ne yapar?", ["Bu adımı atlayıp bir sonraki tekrara geçer", "Döngüyü bitirir", "Programı durdurur", "Değişkeni sıfırlar"], 0],
          ["1'den 100'e kadar 3'e tam bölünen sayıların toplamını bulan algoritmayı yazın ve karmaşıklığını yorumlayın.", "Döngü kurulumunun doğruluğu (3 puan). Bölünebilirlik kontrolü (2 puan). Toplam biriktirme (2 puan). Karmaşıklığın doğrusal olduğunu belirtme (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Fonksiyonlar",
        sorular: [
          ["Fonksiyon kullanmanın temel amacı nedir?", ["Tekrar eden mantığı tek yerde toplayıp yeniden kullanmak", "Programı yavaşlatmak", "Değişken sayısını artırmak", "Dosya boyutunu büyütmek"], 0],
          ["Parametre ile argüman arasındaki fark nedir?", ["Parametre tanımdaki, argüman çağrıdaki değerdir", "İkisi aynıdır", "Argüman tanımda yer alır", "Parametre yalnızca sayı olur"], 0],
          ["Bir fonksiyonun 'yan etkisi' ne demektir?", ["Dışarıdaki bir durumu değiştirmesi", "Değer döndürmesi", "Hızlı çalışması", "Kısa olması"], 0],
          ["Fonksiyonun tek bir iş yapması ilkesi neden önemlidir?", ["Test etmeyi ve yeniden kullanmayı kolaylaştırır", "Belleği azaltır", "Derlemeyi hızlandırır", "Satır sayısını artırır"], 0],
          ["100 satırlık bir fonksiyonu nasıl bölersiniz? Bölme kararınızı hangi ölçütlere göre verirsiniz?", "Tek sorumluluk ilkesine değinme (3 puan). Tekrar eden blokları ayırma (2 puan). Anlamlı isim verme (2 puan). Testedilebilirliğin artacağını belirtme (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Diziler ve Listeler",
        sorular: [
          ["Dizide indeks genellikle kaçtan başlar?", ["0", "1", "-1", "Dile göre 2"], 0],
          ["Bir dizinin uzunluğu 5 ise geçerli en büyük indeks kaçtır?", ["4", "5", "6", "0"], 0],
          ["Dizide olmayan bir indekse erişmek ne sonuç verir?", ["Hata veya tanımsız değer", "Dizinin uzaması", "Programın hızlanması", "Değerin sıfırlanması"], 0],
          ["Bir dizideki tüm elemanları işlemek için en uygun yapı hangisidir?", ["Döngü", "Koşul", "Fonksiyon tanımı", "Sabit tanımı"], 0],
          ["Bir sınıfın notlarını tutan dizide en yüksek notu ve kaç kişinin ortalamanın üzerinde olduğunu bulan algoritmayı anlatın.", "Tek geçişte maksimum bulma (3 puan). Ortalama hesabı (2 puan). İkinci geçişte sayım (3 puan). Boş dizi durumuna değinme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Hata Yönetimi",
        sorular: [
          ["try-catch yapısının amacı nedir?", ["Hata oluştuğunda programın çökmesini engellemek", "Kodu hızlandırmak", "Değişken tanımlamak", "Döngü kurmak"], 0],
          ["Hatanın sessizce yutulması (boş catch) neden kötüdür?", ["Sorun fark edilmeden devam eder", "Program yavaşlar", "Bellek dolar", "Kod uzar"], 0],
          ["Kullanıcıdan sayı beklerken metin girilirse ne yapılmalıdır?", ["Doğrulama yapıp anlaşılır hata mesajı vermek", "Programı kapatmak", "Değeri sıfır kabul etmek", "Hatayı görmezden gelmek"], 0],
          ["Hata mesajı yazarken en önemli ilke nedir?", ["Kullanıcının ne yapması gerektiğini söylemek", "Teknik ayrıntı vermek", "Kısa olmak", "İngilizce yazmak"], 0],
          ["Bir dosya okuma işleminde oluşabilecek hataları sıralayın ve her biri için nasıl davranılması gerektiğini yazın.", "Dosya bulunamadı durumu (2 puan). Erişim izni yok durumu (2 puan). Bozuk/eksik içerik durumu (2 puan). Her biri için kullanıcıya anlamlı geri bildirim (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Sürüm Kontrolü",
        sorular: [
          ["Git'te commit ne anlama gelir?", ["Değişikliklerin kayıt altına alınması", "Dosyanın silinmesi", "Dalın kapatılması", "Sunucuya bağlanılması"], 0],
          ["Dal (branch) kullanmanın amacı nedir?", ["Ana koda dokunmadan paralel geliştirme yapmak", "Dosyaları yedeklemek", "Kodu şifrelemek", "Derlemeyi hızlandırmak"], 0],
          ["Merge çakışması ne zaman oluşur?", ["Aynı satırların iki dalda farklı değiştirilmesiyle", "Dosya silindiğinde", "Commit mesajı uzun olduğunda", "İnternet kesildiğinde"], 0],
          ["İyi bir commit mesajı neyi anlatmalıdır?", ["Değişikliğin ne olduğunu ve nedenini", "Kaç satır değiştiğini", "Kimin yazdığını", "Dosya boyutunu"], 0],
          ["Ekip halinde çalışırken hangi Git akışını önerirsiniz? Adımlarını ve gerekçelerini yazın.", "Özellik dalı açma (2 puan). Küçük ve anlamlı commit'ler (2 puan). Pull request/inceleme adımı (3 puan). Ana dalın korunması gerekçesi (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Veri Tabanı Temelleri",
        sorular: [
          ["İlişkisel veri tabanında tablo neyi temsil eder?", ["Aynı yapıdaki kayıtların kümesini", "Tek bir kaydı", "Bir sorguyu", "Bir kullanıcıyı"], 0],
          ["Birincil anahtar (primary key) ne sağlar?", ["Her satırın benzersiz olarak tanımlanmasını", "Verinin şifrelenmesini", "Sorgunun hızlanmasını garanti eder", "Tablonun küçülmesini"], 0],
          ["Yabancı anahtar (foreign key) ne işe yarar?", ["İki tablo arasında ilişki kurar", "Veriyi sıkıştırır", "Yedek alır", "Kullanıcı ekler"], 0],
          ["SELECT sorgusu ne yapar?", ["Veri okur", "Veri siler", "Tablo oluşturur", "Kullanıcı yetkilendirir"], 0],
          ["Bir okul sisteminde öğrenci, sınav ve cevap tablolarını tasarlayın. Aralarındaki ilişkileri ve anahtarları belirtin.", "Üç tablonun alanlarını tanımlama (3 puan). Birincil anahtarların belirlenmesi (2 puan). Yabancı anahtarlarla ilişkilerin kurulması (3 puan). Bire-çok ilişkisini doğru yorumlama (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Test ve Hata Ayıklama",
        sorular: [
          ["Birim testi (unit test) neyi test eder?", ["Tek bir fonksiyonun/parçanın davranışını", "Tüm sistemi", "Ağ bağlantısını", "Kullanıcı arayüzü tasarımını"], 0],
          ["Test yazmanın en önemli faydası nedir?", ["Değişiklik sonrası bozulmayı erken yakalamak", "Kodu kısaltmak", "Belleği azaltmak", "Derlemeyi hızlandırmak"], 0],
          ["Hata ayıklarken 'kırılma noktası' (breakpoint) ne sağlar?", ["Programı belirli satırda durdurup durumu incelemeyi", "Kodu düzeltmeyi", "Testi çalıştırmayı", "Dosya kaydetmeyi"], 0],
          ["Bir hatayı düzeltmeden önce yapılması gereken ilk şey nedir?", ["Hatayı tekrarlanabilir biçimde üretmek", "Kodu baştan yazmak", "Kütüphane güncellemek", "Testleri silmek"], 0],
          ["Bir hata raporu alıyorsunuz: 'sistem bazen çöküyor'. Hatayı bulmak için izleyeceğiniz adımları sıralayın.", "Tekrarlanabilir adımları netleştirmek için soru sorma (3 puan). Günlük/log inceleme (2 puan). Hipotez kurup daraltma (3 puan). Düzeltmeden sonra test yazma (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Temiz Kod",
        sorular: [
          ["Temiz kodun en temel ölçütü nedir?", ["Başkası tarafından kolay okunabilmesi", "En az satır olması", "En hızlı çalışması", "En çok yorum içermesi"], 0],
          ["Yorum satırı ne zaman gereklidir?", ["Kodun 'neden' öyle yazıldığını açıklarken", "Her satırda", "Değişken tanımlarken", "Hiçbir zaman"], 0],
          ["Kod tekrarının (copy-paste) en büyük riski nedir?", ["Bir yerde düzeltilen hatanın diğerlerinde kalması", "Dosyanın büyümesi", "Derlemenin yavaşlaması", "Renk uyumsuzluğu"], 0],
          ["Uzun parametre listesi neyi işaret eder?", ["Fonksiyonun çok iş yaptığını", "Kodun hızlı olduğunu", "Belleğin yeterli olduğunu", "Testin gereksizliğini"], 0],
          ["Bir arkadaşınızın kodunu incelerken hangi ölçütlere bakarsınız? En az beş madde yazın.", "İsimlendirme kalitesi (2 puan). Fonksiyon uzunluğu ve sorumluluğu (2 puan). Tekrar eden kod (2 puan). Hata yönetimi (2 puan). Test varlığı ve okunabilirlik (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },

  {
    subject: "Enerji Teknolojileri",
    category: "enerji_teknolojileri",
    konular: [
      {
        konu: "Enerji Kaynakları",
        sorular: [
          ["Yenilenebilir enerji kaynağının tanımı nedir?", ["Doğal süreçlerle kendini yenileyen kaynak", "Hiç tükenmeyen fosil yakıt", "Ucuz olan her kaynak", "Yalnızca güneş enerjisi"], 0],
          ["Aşağıdakilerden hangisi yenilenemez enerji kaynağıdır?", ["Kömür", "Rüzgâr", "Güneş", "Jeotermal"], 0],
          ["Fosil yakıtların en büyük çevresel sorunu nedir?", ["Sera gazı salımı", "Ağır olmaları", "Pahalı olmaları", "Az bulunmaları"], 0],
          ["Birincil enerji kaynağı ne demektir?", ["Doğada bulunduğu haliyle kullanılan kaynak", "Elektriğe dönüştürülmüş enerji", "Depolanmış enerji", "İthal edilen enerji"], 0],
          ["Türkiye'nin coğrafi koşulları hangi yenilenebilir kaynaklar için avantajlıdır? En az üç kaynak için gerekçe yazın.", "Güneş için ışınım potansiyeli (2 puan). Rüzgâr için kıyı/koridor bölgeleri (2 puan). Jeotermal için tektonik yapı (2 puan). Hidroelektrik potansiyeline değinme (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Güneş Enerjisi",
        sorular: [
          ["Fotovoltaik panel ne yapar?", ["Güneş ışığını doğrudan elektriğe çevirir", "Suyu ısıtır", "Rüzgârı elektriğe çevirir", "Isıyı depolar"], 0],
          ["Panel verimi neyi ifade eder?", ["Gelen ışık enerjisinin elektriğe dönüşen oranını", "Panelin ağırlığını", "Panelin ömrünü", "Panelin fiyatını"], 0],
          ["Panelin sıcaklığı artınca verim genellikle nasıl değişir?", ["Azalır", "Artar", "Değişmez", "İkiye katlanır"], 0],
          ["Kuzey yarım kürede paneller genellikle hangi yöne bakmalıdır?", ["Güneye", "Kuzeye", "Batıya", "Fark etmez"], 0],
          ["Bir evin çatısına güneş paneli kurulacak. Karar verirken hangi teknik ve ekonomik etkenleri değerlendirirsiniz?", "Çatı yönü, eğimi ve gölgelenme (3 puan). Bölgenin ışınım değeri (2 puan). Tüketim profili ve panel gücü eşleşmesi (2 puan). Yatırım geri dönüş süresi (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Rüzgâr Enerjisi",
        sorular: [
          ["Rüzgâr türbininde elektrik nerede üretilir?", ["Jeneratörde", "Kanatta", "Kulede", "Temelde"], 0],
          ["Rüzgâr hızı iki katına çıkarsa elde edilebilecek güç yaklaşık kaç katına çıkar?", ["8", "2", "4", "16"], 0],
          ["Rüzgâr santrali kurulacak alanda en kritik ölçüm nedir?", ["Uzun süreli rüzgâr hızı ve yönü ölçümü", "Toprak rengi", "Yağış miktarı", "Nüfus yoğunluğu"], 0],
          ["Rüzgâr türbinlerinin çevresel etkilerinden biri nedir?", ["Kuş göç yollarını etkileyebilmesi", "Sera gazı salması", "Su tüketmesi", "Radyoaktif atık üretmesi"], 0],
          ["Rüzgâr enerjisinin en büyük teknik zorluğu üretimin değişken olmasıdır. Bu sorunu nasıl yönetirsiniz?", "Depolama sistemleriyle dengeleme (3 puan). Şebeke entegrasyonu ve tahmin modelleri (3 puan). Farklı kaynaklarla karma kullanım (2 puan). Talep yönetimine değinme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Enerji Depolama",
        sorular: [
          ["Enerji depolamanın yenilenebilir kaynaklar için önemi nedir?", ["Üretim ile tüketim arasındaki zaman farkını kapatması", "Panel verimini artırması", "Rüzgârı hızlandırması", "Kabloyu kısaltması"], 0],
          ["Lityum-iyon pilin öne çıkan özelliği nedir?", ["Yüksek enerji yoğunluğu", "Çok düşük maliyet", "Sınırsız çevrim ömrü", "Isıya tam dayanıklılık"], 0],
          ["Pompajlı hidroelektrik depolama nasıl çalışır?", ["Fazla enerjiyle su yukarı pompalanır, gerekince türbinden geçirilir", "Su ısıtılır", "Su elektroliz edilir", "Su soğutulur"], 0],
          ["Bir pilin 'çevrim ömrü' neyi ifade eder?", ["Kapasitesi belirgin düşene kadar yapabildiği şarj-deşarj sayısını", "Raf ömrünü", "Ağırlığını", "Şarj süresini"], 0],
          ["Bir okul binası için enerji depolama sistemi seçerken hangi ölçütleri değerlendirirsiniz?", "Kapasite ve güç ihtiyacının belirlenmesi (3 puan). Çevrim ömrü ve maliyet karşılaştırması (3 puan). Güvenlik ve yerleşim gereksinimleri (2 puan). Bakım ve geri dönüşüm (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Enerji Verimliliği",
        sorular: [
          ["Enerji verimliliği ne demektir?", ["Aynı işi daha az enerjiyle yapmak", "Enerji üretimini artırmak", "Enerjiyi depolamak", "Enerjiyi ithal etmek"], 0],
          ["LED aydınlatmanın akkor ampule göre avantajı nedir?", ["Aynı ışık için çok daha az enerji tüketmesi", "Daha ucuz olması", "Daha sıcak olması", "Daha ağır olması"], 0],
          ["Binalarda yalıtımın enerji tüketimine etkisi nedir?", ["Isıtma ve soğutma ihtiyacını azaltır", "Elektrik üretir", "Aydınlatmayı artırır", "Su tüketimini azaltır"], 0],
          ["Bekleme (standby) tüketimi nedir?", ["Cihaz kapalı görünürken çektiği güç", "Cihazın tam güçte tüketimi", "Şarj sırasındaki tüketim", "Fabrika tüketimi"], 0],
          ["Okulunuzun elektrik faturasını düşürmek için bir plan hazırlayın. Ölçüm, önlem ve doğrulama adımlarını yazın.", "Mevcut tüketimin ölçülmesi (3 puan). En az üç somut önlem (3 puan). Önlemlerin maliyet/kazanç değerlendirmesi (2 puan). Sonucun nasıl doğrulanacağı (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Elektrik Şebekesi",
        sorular: [
          ["Elektrik iletiminde yüksek gerilim neden kullanılır?", ["Hat kayıplarını azaltmak için", "Kabloyu ucuzlatmak için", "Güvenliği artırmak için", "Frekansı yükseltmek için"], 0],
          ["Transformatörün görevi nedir?", ["Gerilim seviyesini değiştirmek", "Akımı doğrultmak", "Enerji üretmek", "Enerji depolamak"], 0],
          ["Akıllı şebeke (smart grid) neyi sağlar?", ["Üretim ve tüketimin veriyle anlık yönetilmesini", "Yalnızca kablo kalınlığının artmasını", "Yalnızca sayaç okumasını", "Yalnızca fatura basımını"], 0],
          ["Dağıtık üretim ne demektir?", ["Enerjinin tüketim noktasına yakın, küçük birimlerde üretilmesi", "Tek büyük santralde üretim", "Yalnızca ithal enerji", "Yalnızca gece üretim"], 0],
          ["Çatı panelleri yaygınlaşınca şebekede hangi yeni sorunlar ortaya çıkar? Çözüm önerilerinizi yazın.", "Ters akış ve gerilim yükselmesi (3 puan). Üretim-tüketim dengesizliği (2 puan). Depolama ve akıllı sayaç çözümleri (3 puan). Şebeke yatırımı gerekliliği (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Karbon Ayak İzi",
        sorular: [
          ["Karbon ayak izi neyi ölçer?", ["Bir faaliyetin neden olduğu sera gazı salımını", "Su tüketimini", "Atık miktarını", "Enerji üretimini"], 0],
          ["Aşağıdakilerden hangisi karbon ayak izini azaltır?", ["Toplu taşıma kullanmak", "Kısa mesafeye araba kullanmak", "Cihazları bekleme modunda bırakmak", "Fazla ambalajlı ürün almak"], 0],
          ["Elektrikli aracın karbon ayak izi neye bağlıdır?", ["Elektriğin nasıl üretildiğine", "Aracın rengine", "Lastik markasına", "Sürücü sayısına"], 0],
          ["'Yaşam döngüsü analizi' neyi kapsar?", ["Üretimden atığa kadar tüm aşamaların etkisini", "Yalnızca kullanım aşamasını", "Yalnızca üretim aşamasını", "Yalnızca taşımayı"], 0],
          ["Okulunuzun karbon ayak izini hesaplamak için hangi verileri toplarsınız? Azaltmak için üç öneri yazın.", "Elektrik, ısınma ve ulaşım verilerinin toplanması (3 puan). Atık ve tüketim malzemelerine değinme (2 puan). Üç uygulanabilir azaltma önerisi (3 puan). Ölçüm ve takip planı (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Hidrojen ve Yakıt Pilleri",
        sorular: [
          ["Yakıt pili nasıl elektrik üretir?", ["Hidrojen ve oksijenin kimyasal tepkimesiyle", "Yanma yoluyla", "Manyetik indüksiyonla", "Güneş ışığıyla"], 0],
          ["Yakıt pilinin egzoz ürünü nedir?", ["Su", "Karbondioksit", "Azot oksit", "Kükürt dioksit"], 0],
          ["'Yeşil hidrojen' ne demektir?", ["Yenilenebilir enerjiyle elektrolizden üretilen hidrojen", "Doğal gazdan üretilen hidrojen", "Kömürden üretilen hidrojen", "Renklendirilmiş hidrojen"], 0],
          ["Hidrojenin depolanmasındaki temel zorluk nedir?", ["Düşük hacimsel enerji yoğunluğu ve yüksek basınç ihtiyacı", "Ağır olması", "Yanmaması", "Pahalı olmaması"], 0],
          ["Hidrojen yakıt pilli araçlarla bataryalı elektrikli araçları karşılaştırın. Hangi kullanım alanında hangisi daha uygundur?", "Doldurma süresi ve menzil karşılaştırması (3 puan). Altyapı gereksinimi farkı (2 puan). Verimlilik zinciri karşılaştırması (3 puan). Ağır taşımacılık/binek ayrımı ile sonuçlandırma (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Enerji Ölçümü",
        sorular: [
          ["Elektrik enerjisi hangi birimle faturalandırılır?", ["kWh", "kW", "Volt", "Amper"], 0],
          ["2 kW gücündeki bir cihaz 3 saat çalışırsa kaç kWh tüketir?", ["6", "5", "1.5", "0.67"], 0],
          ["Güç ile enerji arasındaki fark nedir?", ["Güç anlık, enerji zamana yayılmış tüketimdir", "İkisi aynıdır", "Enerji anlıktır", "Güç zamana bağlıdır"], 0],
          ["Akıllı sayaç klasik sayaçtan hangi yönüyle ayrılır?", ["Tüketimi zaman bazlı kaydedip iletebilmesi", "Daha büyük olması", "Daha ucuz olması", "Elektrik üretmesi"], 0],
          ["Bir sınıftaki cihazların günlük enerji tüketimini hesaplamak için nasıl bir ölçüm planı kurarsınız?", "Cihaz güçlerinin belirlenmesi (2 puan). Çalışma sürelerinin kaydedilmesi (3 puan). kWh hesabının doğru yapılması (3 puan). Bekleme tüketiminin göz önüne alınması (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Sürdürülebilirlik",
        sorular: [
          ["Sürdürülebilirlik tanımı hangisidir?", ["Gelecek kuşakların ihtiyaçlarını tehlikeye atmadan bugünü karşılamak", "En hızlı büyümeyi sağlamak", "En ucuz üretimi yapmak", "En çok enerji üretmek"], 0],
          ["Döngüsel ekonomi neyi hedefler?", ["Atığı kaynağa dönüştürerek döngüde tutmayı", "Üretimi durdurmayı", "Tüketimi artırmayı", "İthalatı çoğaltmayı"], 0],
          ["Geri dönüşümün enerji açısından faydası nedir?", ["Ham maddeden üretime göre daha az enerji gerektirmesi", "Daha çok enerji tüketmesi", "Enerji üretmesi", "Enerjiyi depolaması"], 0],
          ["Aşağıdakilerden hangisi sürdürülebilir tasarım ilkesidir?", ["Ürünü onarılabilir tasarlamak", "Ürünü kısa ömürlü yapmak", "Karışık malzeme kullanmak", "Ambalajı büyütmek"], 0],
          ["Okulunuzda bir sürdürülebilirlik projesi başlatacaksınız. Konu seçimi, ölçüm ve başarı ölçütünüzü yazın.", "Somut ve ölçülebilir bir konu seçimi (3 puan). Başlangıç durumunun ölçülmesi (2 puan). Uygulanacak eylemler (3 puan). Başarı ölçütü ve raporlama (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },
];
