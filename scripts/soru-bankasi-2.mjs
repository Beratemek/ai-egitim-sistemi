/**
 * Soru bankasi - 2. bolum: Siber Guvenlik, Elektronik ve IoT.
 *
 * Bicim icin bkz. soru-bankasi-1.mjs
 */

export const BOLUM_2 = [
  {
    subject: "Siber Güvenlik",
    category: "siber_guvenlik",
    konular: [
      {
        konu: "Bilgi Güvenliği Temelleri",
        sorular: [
          ["Bilgi güvenliğinin üç temel bileşeni hangisidir?", ["Gizlilik, bütünlük, erişilebilirlik", "Hız, kapasite, maliyet", "Yazılım, donanım, ağ", "Kullanıcı, yönetici, misafir"], 0],
          ["'Bütünlük' ilkesi neyi güvence altına alır?", ["Verinin yetkisiz biçimde değiştirilmemesini", "Verinin hızlı iletilmesini", "Verinin ucuz saklanmasını", "Verinin herkese açık olmasını"], 0],
          ["Bir hizmetin çökertilerek erişilemez kılınması hangi ilkeyi ihlal eder?", ["Erişilebilirlik", "Gizlilik", "Bütünlük", "İnkâr edilemezlik"], 0],
          ["Kimlik doğrulama (authentication) ile yetkilendirme (authorization) farkı nedir?", ["Doğrulama kim olduğunu, yetkilendirme neye erişebileceğini belirler", "İkisi aynıdır", "Yetkilendirme parolayı kontrol eder", "Doğrulama izinleri belirler"], 0],
          ["Bir okul ağında bilgi güvenliğinin üç bileşenini tehdit eden birer senaryo yazın ve önlem önerin.", "Her bileşen için gerçekçi senaryo (3 puan). Her senaryoya uygun önlem (3 puan). Önlemlerin uygulanabilir olması (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Parola Güvenliği",
        sorular: [
          ["Güçlü bir parolanın en önemli özelliği nedir?", ["Uzun ve tahmin edilemez olması", "Büyük harfle başlaması", "Ad soyad içermesi", "Sık değiştirilmesi"], 0],
          ["Parolaların veri tabanında saklanma biçimi hangisi olmalıdır?", ["Tuzlanmış özet (salted hash)", "Düz metin", "Base64 kodlanmış", "Ters çevrilmiş metin"], 0],
          ["İki aşamalı doğrulama (2FA) neyi sağlar?", ["Parola çalınsa bile ikinci bir doğrulama gerektirir", "Parolayı uzatır", "Parolayı şifreler", "Oturumu hızlandırır"], 0],
          ["Aynı parolayı birden fazla sitede kullanmanın riski nedir?", ["Bir sitedeki sızıntı diğer hesapları da açar", "Parolanın unutulması", "Girişin yavaşlaması", "Tarayıcının çökmesi"], 0],
          ["Bir kurum için parola politikası yazacaksınız. Hangi kuralları koyar, hangilerinden kaçınırsınız? Gerekçelendirin.", "Uzunluk önceliği ve gerekçesi (3 puan). 2FA zorunluluğu (2 puan). Parola yöneticisi önerisi (2 puan). Sık zorunlu değiştirmenin neden zayıflatabildiğine değinme (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Sosyal Mühendislik",
        sorular: [
          ["Sosyal mühendislik saldırısı neyi hedefler?", ["Teknik açığı değil insan davranışını", "Yalnızca sunucu yazılımını", "Yalnızca ağ donanımını", "Yalnızca veri tabanını"], 0],
          ["Oltalama (phishing) e-postasının tipik işareti nedir?", ["Aciliyet baskısı ve şüpheli bağlantı", "Kurumsal imza", "Doğru yazım", "Kısa metin"], 0],
          ["Bir e-postanın gerçekten kurumdan geldiğini doğrulamanın en güvenilir yolu nedir?", ["Kurumu bilinen resmî kanaldan aramak", "Gönderen adını okumak", "Bağlantıya tıklamak", "E-postayı yanıtlamak"], 0],
          ["'Omuz sörfü' (shoulder surfing) nedir?", ["Kullanıcının ekranını/klavyesini izleyerek bilgi çalma", "Ağ trafiğini dinleme", "Parola kırma", "Zararlı yazılım yayma"], 0],
          ["Okulunuza gelen sahte bir 'bilgi işlem' e-postası öğrencilerden parola istiyor. Şüphelenmenizi sağlayacak işaretleri ve yapılması gerekenleri yazın.", "Parolanın asla e-postayla istenmeyeceğini belirtme (3 puan). Alan adı/bağlantı kontrolü (2 puan). Aciliyet dilinin işaret olduğunu belirtme (2 puan). Bildirme ve tıklamama adımları (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Zararlı Yazılımlar",
        sorular: [
          ["Fidye yazılımı (ransomware) ne yapar?", ["Verileri şifreleyip fidye ister", "Ağ hızını artırır", "Yedek alır", "Parolaları güçlendirir"], 0],
          ["Truva atı (trojan) nasıl yayılır?", ["Zararsız görünen bir yazılımın içinde", "Yalnızca ağ üzerinden kendiliğinden", "Yalnızca USB ile", "Yalnızca e-posta ekiyle"], 0],
          ["Solucanın (worm) virüsten farkı nedir?", ["Kendini yaymak için kullanıcıya ihtiyaç duymaz", "Daha yavaştır", "Dosyaları siler", "Yalnızca sunucuları etkiler"], 0],
          ["Fidye yazılımına karşı en etkili önlem nedir?", ["Düzenli ve çevrimdışı yedek almak", "Antivirüsü kapatmak", "Parolayı değiştirmek", "Dosyaları yeniden adlandırmak"], 0],
          ["Bilgisayarınıza fidye yazılımı bulaştığını fark ettiniz. Adım adım ne yaparsınız? Fidye ödemek doğru mudur, tartışın.", "Cihazı ağdan ayırma (2 puan). Yetkiliye bildirme (2 puan). Yedekten geri dönme (2 puan). Fidye ödemenin çözüm garantisi olmadığını ve saldırıyı teşvik ettiğini açıklama (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Ağ Güvenliği",
        sorular: [
          ["Güvenlik duvarı (firewall) ne yapar?", ["Ağ trafiğini kurallara göre süzer", "Veriyi şifreler", "Parola üretir", "Yedek alır"], 0],
          ["Halka açık Wi-Fi'da en büyük risk nedir?", ["Trafiğin dinlenebilmesi", "İnternetin yavaş olması", "Pilin bitmesi", "Cihazın ısınması"], 0],
          ["VPN kullanmanın temel faydası nedir?", ["Trafiği şifreleyerek araya girmeyi zorlaştırması", "İndirme hızını artırması", "Virüsleri temizlemesi", "Depolama sağlaması"], 0],
          ["'Ortadaki adam' saldırısında saldırgan ne yapar?", ["İki taraf arasındaki iletişimi araya girerek dinler veya değiştirir", "Sunucuyu kapatır", "Parolayı sıfırlar", "Yedeği siler"], 0],
          ["Kafede halka açık Wi-Fi kullanmak zorundasınız. Riskleri azaltmak için hangi önlemleri alırsınız?", "HTTPS kontrolü (2 puan). VPN kullanımı (2 puan). Hassas işlemlerden kaçınma (2 puan). Otomatik bağlanmayı ve dosya paylaşımını kapatma (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "Şifreleme",
        sorular: [
          ["Simetrik şifrelemede kaç anahtar kullanılır?", ["Tek anahtar", "İki farklı anahtar", "Üç anahtar", "Anahtar kullanılmaz"], 0],
          ["Asimetrik şifrelemede açık anahtar ne için kullanılır?", ["Şifrelemek için", "Yalnızca çözmek için", "Parola saklamak için", "Yedek almak için"], 0],
          ["HTTPS bağlantısı neyi garanti eder?", ["Trafiğin şifrelendiğini ve sunucunun doğrulandığını", "Sitenin güvenilir içerik sunduğunu", "Sitenin hızlı olduğunu", "Verinin yedeklendiğini"], 0],
          ["Özet (hash) fonksiyonunun temel özelliği nedir?", ["Tek yönlü olması, geri döndürülememesi", "Şifreyi çözebilmesi", "Veriyi sıkıştırması", "Anahtar üretmesi"], 0],
          ["Bir mesajlaşma uygulamasında 'uçtan uca şifreleme' ne demektir ve neden önemlidir?", "Yalnızca gönderen ve alıcının çözebildiğini açıklama (3 puan). Sunucunun bile okuyamadığını belirtme (2 puan). Gizlilik açısından önemini gerekçelendirme (2 puan). Sınırlılıklarına değinme, örn. üst veri (2 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Web Uygulama Güvenliği",
        sorular: [
          ["SQL enjeksiyonu nasıl gerçekleşir?", ["Kullanıcı girdisinin sorguya doğrudan eklenmesiyle", "Sunucunun yavaşlamasıyla", "Parolanın kısa olmasıyla", "Tarayıcı eklentisiyle"], 0],
          ["SQL enjeksiyonuna karşı en etkili önlem nedir?", ["Parametreli sorgu kullanmak", "Girdiyi büyük harfe çevirmek", "Sorguyu kısaltmak", "Veri tabanını yeniden başlatmak"], 0],
          ["XSS saldırısı neyi hedefler?", ["Kullanıcının tarayıcısında zararlı betik çalıştırmayı", "Sunucu diskini doldurmayı", "Ağ kablosunu kesmeyi", "Veri tabanını yedeklemeyi"], 0],
          ["Kullanıcı girdisine neden asla güvenilmez?", ["Her girdi saldırgan tarafından değiştirilebilir", "Girdiler her zaman uzundur", "Girdiler yavaş gelir", "Girdiler şifrelidir"], 0],
          ["Bir öğrenci not girişi sayfası yazıyorsunuz. Hangi güvenlik kontrollerini eklersiniz? Sunucu ve istemci tarafını ayırarak yazın.", "Sunucu tarafı doğrulamanın zorunlu olduğunu belirtme (3 puan). Yetki kontrolü, örn. yalnızca öğretmen (3 puan). Parametreli sorgu/ORM kullanımı (2 puan). İstemci doğrulamasının yalnızca kolaylık olduğunu belirtme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Erişim Kontrolü",
        sorular: [
          ["En az yetki ilkesi ne demektir?", ["Kullanıcıya işini yapacak kadar yetki verilmesi", "Herkese yönetici yetkisi verilmesi", "Yetkilerin hiç verilmemesi", "Yetkilerin yılda bir değişmesi"], 0],
          ["Rol tabanlı erişim kontrolünde izinler neye bağlanır?", ["Role", "Kullanıcı adına", "IP adresine", "Tarayıcıya"], 0],
          ["Bir kullanıcının kendi yetkisini yükseltebilmesi hangi açıktır?", ["Yetki yükseltme (privilege escalation)", "Oltalama", "Fidye yazılımı", "Kaba kuvvet"], 0],
          ["Yetki kontrolü nerede yapılmalıdır?", ["Sunucu tarafında", "Yalnızca arayüzde", "Yalnızca veritabanı adında", "Yalnızca URL'de"], 0],
          ["Bir eğitim platformunda öğrenci, eğitmen ve yönetici rolleri var. Her rolün erişemeyeceği verileri belirleyip nedenini yazın.", "Öğrencinin doğru cevap ve rubriğe erişememesi (3 puan). Eğitmenin yalnızca kendi/yetkili dersine erişmesi (3 puan). Yöneticinin rol yönetimi dışına çıkmaması (2 puan). Kontrolün sunucuda olması gerektiğini belirtme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Yedekleme ve Kurtarma",
        sorular: [
          ["3-2-1 yedekleme kuralı neyi önerir?", ["3 kopya, 2 farklı ortam, 1 tanesi farklı konumda", "3 gün, 2 saat, 1 dakika", "3 parola, 2 kullanıcı, 1 yönetici", "3 sunucu, 2 ağ, 1 kablo"], 0],
          ["Yedeğin düzenli olarak test edilmesi neden gereklidir?", ["Geri yüklenemeyen yedek yedek sayılmaz", "Disk ömrü uzasın diye", "Hız artsın diye", "Yer açmak için"], 0],
          ["Çevrimdışı yedeğin avantajı nedir?", ["Ağ üzerinden gelen saldırılardan etkilenmemesi", "Daha hızlı olması", "Daha ucuz olması", "Otomatik çalışması"], 0],
          ["Artımlı (incremental) yedeklemenin avantajı nedir?", ["Yalnızca değişen veriyi alarak süre ve yer kazandırması", "Her seferinde tam kopya alması", "Şifreleme sağlaması", "Sıkıştırma yapmaması"], 0],
          ["Okulunuzun sunucusu için bir yedekleme planı yazın: ne, ne sıklıkla, nereye ve nasıl doğrulanacak?", "Yedeklenecek verinin tanımlanması (2 puan). Sıklık ve gerekçesi (2 puan). Farklı konum/ortam kullanımı (2 puan). Geri yükleme testinin planlanması (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Güvenli Yazılım Geliştirme",
        sorular: [
          ["Gizli anahtarlar (API key) nerede saklanmamalıdır?", ["Kaynak kod deposunda", "Ortam değişkeninde", "Gizli anahtar yöneticisinde", "Sunucu yapılandırmasında"], 0],
          ["Bağımlılık güncellemeleri neden önemlidir?", ["Bilinen güvenlik açıklarını kapatır", "Kod satırını azaltır", "Derlemeyi hızlandırır", "Renkleri değiştirir"], 0],
          ["Kod incelemesi (code review) güvenliğe nasıl katkı sağlar?", ["İkinci bir gözün açıkları fark etmesini sağlar", "Kodu kısaltır", "Testleri kaldırır", "Dağıtımı hızlandırır"], 0],
          ["Hata mesajlarında ayrıntılı sistem bilgisi göstermenin riski nedir?", ["Saldırgana sistem hakkında ipucu vermesi", "Kullanıcıyı yormaları", "Sayfayı yavaşlatması", "Çeviriyi zorlaştırması"], 0],
          ["Bir web projesinde gizli anahtar yanlışlıkla herkese açık depoya gönderildi. Sırasıyla ne yaparsınız?", "Anahtarı hemen iptal edip yenisini üretme (3 puan). Geçmişten temizlemenin tek başına yetmediğini belirtme (3 puan). Erişim günlüklerini inceleme (2 puan). Gelecekte önleme, örn. gizli tarama, ortam değişkeni (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },

  {
    subject: "Elektronik ve IoT",
    category: "elektronik_programlama_ve_iot",
    konular: [
      {
        konu: "Temel Elektrik Büyüklükleri",
        sorular: [
          ["Ohm yasası hangi bağıntıyı ifade eder?", ["V = I × R", "P = V / I", "R = I × V", "I = V × R"], 0],
          ["12 V gerilim altında 4 Ω direncin üzerinden geçen akım kaç amperdir?", ["3 A", "48 A", "0.33 A", "8 A"], 0],
          ["Elektriksel güç nasıl hesaplanır?", ["P = V × I", "P = V / I", "P = I / V", "P = V + I"], 0],
          ["Seri bağlı iki direncin eşdeğeri nasıl bulunur?", ["Dirençler toplanır", "Dirençler çarpılır", "Terslerinin toplamı alınır", "Farkları alınır"], 0],
          ["Bir LED'i 5 V kaynağa bağlarken neden seri direnç kullanılır? Değerini nasıl hesaplarsınız?", "LED'in akım sınırlaması olmadığını ve yanabileceğini açıklama (3 puan). R = (Vkaynak - VLED) / ILED formülünü yazma (3 puan). Örnek hesap yapma (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Devre Elemanları",
        sorular: [
          ["Kondansatörün temel görevi nedir?", ["Elektrik yükü depolamak", "Akımı tek yönde geçirmek", "Direnç göstermek", "Işık yaymak"], 0],
          ["Diyot devrede ne yapar?", ["Akımı tek yönde geçirir", "Gerilimi yükseltir", "Yük depolar", "Frekans üretir"], 0],
          ["Transistör en yaygın olarak hangi amaçla kullanılır?", ["Anahtarlama ve yükseltme", "Yük depolama", "Işık yayma", "Direnç ölçme"], 0],
          ["Röle ne işe yarar?", ["Düşük güçlü sinyalle yüksek güçlü devreyi anahtarlamak", "Gerilimi düşürmek", "Akımı ölçmek", "Sinyal üretmek"], 0],
          ["Bir mikrodenetleyici pinine doğrudan röle bağlamak neden sakıncalıdır? Doğru bağlantıyı anlatın.", "Pinin akım sınırının aşılacağını belirtme (3 puan). Transistör/optokuplör ile sürme (3 puan). Ters akım için diyot (flyback) kullanımı (3 puan). Toplam 9 puan."],
        ],
      },
      {
        konu: "Mikrodenetleyici Pinleri",
        sorular: [
          ["Dijital bir pinin INPUT_PULLUP modu ne sağlar?", ["Pini dahili direnç ile yüksek seviyeye çeker", "Pini toprağa bağlar", "Pini analog yapar", "Pini çıkışa çevirir"], 0],
          ["Bir butonu okurken 'yüzen giriş' (floating) sorunu nedir?", ["Pinin belirsiz değer okuması", "Butonun ısınması", "Pinin yanması", "Kodun uzaması"], 0],
          ["Buton titremesi (debounce) neden oluşur?", ["Mekanik kontakların anlık olarak birden fazla kez temas etmesi", "Yazılım hatası", "Gerilim yüksekliği", "Kablonun uzunluğu"], 0],
          ["PWM çıkışı verebilen pinler genellikle nasıl işaretlenir?", ["~ işareti veya PWM etiketiyle", "A harfiyle", "GND yazısıyla", "VCC yazısıyla"], 0],
          ["Bir butonun basılma sayısını doğru saymak için yazılımda hangi önlemleri alırsınız?", "Debounce için zaman kontrolü veya kütüphane kullanımı (3 puan). Kenar algılama, önceki durumu saklama (3 puan). Gerekirse donanımsal RC filtre (2 puan). Toplam 8 puan."],
        ],
      },
      {
        konu: "IoT Mimarisi",
        sorular: [
          ["IoT sisteminde 'uç cihaz' (edge device) ne yapar?", ["Ortamdan veri toplar ve/veya işler", "Yalnızca veri saklar", "Yalnızca arayüz sunar", "Yalnızca fatura keser"], 0],
          ["Uç işleme (edge computing) neden tercih edilir?", ["Gecikmeyi ve bant genişliği kullanımını azaltır", "Bulut maliyetini artırır", "Veriyi çoğaltır", "Güvenliği zayıflatır"], 0],
          ["IoT'de ağ geçidinin (gateway) görevi nedir?", ["Cihazlarla bulut arasında köprü kurmak", "Sensör üretmek", "Ekran çizmek", "Pil şarj etmek"], 0],
          ["Aşağıdakilerden hangisi bir IoT uygulamasıdır?", ["Akıllı sulama sistemi", "Masaüstü hesap makinesi", "Çevrimdışı metin editörü", "Basılı takvim"], 0],
          ["Bir seranın sıcaklık ve nem takibi için IoT sistemi tasarlayın. Katmanları ve her katmandaki bileşenleri yazın.", "Sensör/uç cihaz katmanı (2 puan). Haberleşme katmanı ve protokol seçimi (3 puan). Bulut/veri saklama katmanı (2 puan). Arayüz ve uyarı mekanizması (3 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Haberleşme Protokolleri",
        sorular: [
          ["MQTT protokolü hangi modeli kullanır?", ["Yayınla-abone ol (publish-subscribe)", "İstek-yanıt", "Dosya paylaşımı", "Doğrudan bağlantı"], 0],
          ["MQTT'de 'broker' ne yapar?", ["Mesajları ilgili abonelere dağıtır", "Sensörü okur", "Cihazı şarj eder", "Ekran çizer"], 0],
          ["I2C haberleşmesinde kaç hat kullanılır?", ["2 (SDA ve SCL)", "1", "3", "4"], 0],
          ["SPI'ın I2C'ye göre avantajı nedir?", ["Daha yüksek hız", "Daha az kablo", "Adresleme kolaylığı", "Daha uzun mesafe"], 0],
          ["Pil ile çalışan bir sensör düğümü için MQTT mi HTTP mi seçersiniz? Gerekçelendirin.", "MQTT'nin daha az veri başlığı taşıdığını belirtme (3 puan). Sürekli bağlantı ve düşük güç avantajı (3 puan). HTTP'nin istek başına maliyetini karşılaştırma (2 puan). Seçimi gerekçeyle bağlama (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Kablosuz Bağlantı",
        sorular: [
          ["Wi-Fi'ın Bluetooth'a göre temel avantajı nedir?", ["Daha yüksek bant genişliği ve menzil", "Daha düşük güç tüketimi", "Daha ucuz donanım", "Daha basit eşleşme"], 0],
          ["BLE'nin (Bluetooth Low Energy) tasarım amacı nedir?", ["Düşük güç tüketimiyle küçük veri aktarımı", "Video akışı", "Uzun mesafe iletişim", "Yüksek hızlı dosya transferi"], 0],
          ["LoRa teknolojisinin öne çıkan özelliği nedir?", ["Uzun menzil ve düşük veri hızı", "Çok yüksek veri hızı", "Kablolu bağlantı", "Yalnızca iç mekân"], 0],
          ["ESP32'nin IoT projelerinde tercih edilme nedeni nedir?", ["Wi-Fi ve Bluetooth'u tümleşik barındırması", "Ekranının olması", "Pil içermesi", "Programlanamaması"], 0],
          ["Şehir genelinde su sayaçlarını uzaktan okumak istiyorsunuz. Hangi kablosuz teknolojiyi seçersiniz? Karşılaştırarak gerekçelendirin.", "LoRa/NB-IoT gibi uzun menzilli teknoloji seçimi (3 puan). Menzil ve güç gereksinimini gerekçe gösterme (3 puan). Wi-Fi/BLE'nin neden uygun olmadığını açıklama (2 puan). Veri hızının yeterliliğine değinme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Sensör Verisi ve Kalibrasyon",
        sorular: [
          ["Kalibrasyon ne demektir?", ["Sensör okumasını bilinen bir referansa göre düzeltmek", "Sensörü temizlemek", "Sensörü değiştirmek", "Sensörü kapatmak"], 0],
          ["Sensör kayması (drift) nedir?", ["Zamanla ölçümün gerçek değerden uzaklaşması", "Sensörün yer değiştirmesi", "Kablonun kopması", "Verinin şifrelenmesi"], 0],
          ["Hareketli ortalama filtresi ne işe yarar?", ["Ani gürültü sıçramalarını yumuşatmak", "Veriyi şifrelemek", "Örnekleme hızını artırmak", "Sensörü kalibre etmek"], 0],
          ["Aykırı değer (outlier) ile nasıl başa çıkılır?", ["Medyan filtresi gibi yöntemlerle elemek", "Ortalamaya dahil etmek", "Veriyi silmek", "Sensörü yeniden başlatmak"], 0],
          ["Bir nem sensörü zamanla sapma gösteriyor. Sorunu tespit ve düzeltme sürecinizi anlatın.", "Referans cihazla karşılaştırma (3 puan). Sapmanın doğrusal olup olmadığını inceleme (2 puan). Yazılımda düzeltme katsayısı uygulama (3 puan). Periyodik kalibrasyon planı (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Güç Yönetimi",
        sorular: [
          ["Uyku modu (sleep mode) neyi sağlar?", ["Cihazın boşta olduğunda çok az akım çekmesini", "İşlemcinin hızlanmasını", "Belleğin artmasını", "Sensörün kalibre olmasını"], 0],
          ["2000 mAh'lik bir pil, 100 mA çeken bir devreyi kabaca kaç saat besler?", ["20 saat", "200 saat", "2 saat", "2000 saat"], 0],
          ["Pil ömrünü uzatmak için en etkili yaklaşım nedir?", ["Ölçüm aralığını seyrekleştirip uyku moduna geçmek", "Ekranı sürekli açık tutmak", "Wi-Fi'ı hep bağlı bırakmak", "Örnekleme hızını artırmak"], 0],
          ["Gerilim regülatörünün görevi nedir?", ["Değişken giriş geriliminden sabit çıkış üretmek", "Akımı artırmak", "Frekans üretmek", "Veri iletmek"], 0],
          ["Günde bir kez veri gönderen, pille çalışan bir sensör düğümünün güç bütçesini nasıl planlarsınız?", "Aktif ve uyku akımlarının ayrı hesaplanması (3 puan). Görev süresi ve döngü hesabı (3 puan). Ortalama akımdan pil ömrü hesabı (2 puan). Verimlilik/kayıp payı ekleme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "IoT Güvenliği",
        sorular: [
          ["IoT cihazlarında en yaygın güvenlik zaafı nedir?", ["Varsayılan parolaların değiştirilmemesi", "Küçük olmaları", "Pil kullanmaları", "Sensör içermeleri"], 0],
          ["Cihaz yazılımının uzaktan güncellenebilmesi neden önemlidir?", ["Açıkların sahada kapatılabilmesi için", "Pil ömrü için", "Boyut küçültmek için", "Renk değiştirmek için"], 0],
          ["IoT trafiğinin şifrelenmesi neyi engeller?", ["Araya girip veriyi okumayı ve değiştirmeyi", "Pilin bitmesini", "Sensör hatasını", "Kod hatasını"], 0],
          ["Bir IoT cihazının ağda ayrı bir bölüme (VLAN) alınmasının nedeni nedir?", ["Ele geçirilirse diğer sistemlere sıçramasını sınırlamak", "Hızını artırmak", "Pilini korumak", "Sensörünü kalibre etmek"], 0],
          ["Evinizdeki akıllı kamerayı güvenli kurmak için hangi adımları izlersiniz?", "Varsayılan parolayı değiştirme (2 puan). Yazılımı güncel tutma (2 puan). Ayrı ağ/VLAN kullanma (2 puan). Gereksiz uzaktan erişimi kapatma (2 puan). Kayıtların nerede saklandığını denetleme (2 puan). Toplam 10 puan."],
        ],
      },
      {
        konu: "Veri Görselleştirme",
        sorular: [
          ["Zaman içindeki sıcaklık değişimini göstermek için en uygun grafik hangisidir?", ["Çizgi grafiği", "Pasta grafiği", "Ağaç haritası", "Balon grafiği"], 0],
          ["Pasta grafiği ne zaman uygundur?", ["Bir bütünün az sayıdaki parçasını göstermek için", "Zaman serisi için", "İki değişken ilişkisi için", "Dağılım için"], 0],
          ["Bir gösterge panelinde en önemli bilgi nereye konmalıdır?", ["Görsel olarak en belirgin ve üst bölgeye", "En alta", "Sağ köşeye küçük punto ile", "Ayrı bir sayfaya"], 0],
          ["Eksenin sıfırdan başlamaması hangi riski doğurur?", ["Farkların olduğundan büyük görünmesi", "Grafiğin okunamaması", "Verinin bozulması", "Renklerin kaybolması"], 0],
          ["Sera projeniz için bir gösterge paneli tasarlıyorsunuz. Hangi verileri, hangi grafiklerle ve neden gösterirsiniz?", "Anlık değerler için sayısal gösterge (2 puan). Zaman serisi için çizgi grafiği (3 puan). Eşik aşımları için uyarı gösterimi (3 puan). Sadelik ve okunabilirlik gerekçesi (2 puan). Toplam 10 puan."],
        ],
      },
    ],
  },
];
