# Mobil uygulama (Capacitor)

Web uygulaması native bir kabuğun içinde çalışıyor. Aynı kod tabanı hem
siteyi hem uygulamayı besliyor — ayrı bir arayüz yok.

## Neden böyle kuruldu

Capacitor'ün alışıldık yolu, siteyi statik dosyalara dışa aktarıp
(`output: "export"`) telefona gömmektir. **Bu proje için mümkün değil.**
Uygulama baştan sona sunucu taraflı: Server Component'ler, server action'lar
ve `middleware.ts` içindeki oturum/rol koruması. Statik dışa aktarımda
sayfalar boş çıkar, giriş ve yetki kontrolü tümüyle devre dışı kalır.

Bunun yerine native kabuk **yayındaki siteyi yüklüyor** (`server.url`).
Sonuç mağazadan kurulan gerçek bir uygulama, ama içeriği sunucudan geliyor.

İki sonucu var, ikisi de bilerek kabul edildi:

1. **Uygulama internet ister.** Çevrimdışı çalışmaz; bağlantı yoksa
   `capacitor/web/index.html` içindeki bilgilendirme ekranı görünür.
2. **Site yayına alınmadan uygulama derlenemez.** `CAPACITOR_SERVER_URL`
   tanımlı değilse yapılandırma bilinçli olarak hata verir — sessizce
   localhost'a düşüp telefonda "bağlanılamadı" ekranı vermektense.

## Kurulum

### 1. Siteyi yayına alın

Uygulama bu adresi yükleyecek. Vercel en kısa yol:

```
vercel --prod
```

`.env` içindeki Supabase değişkenlerini yayın ortamına da tanımlamayı
unutmayın.

### 2. Adresi vererek eşitleyin

```
CAPACITOR_SERVER_URL="https://<adresiniz>" npm run app:sync
```

### 3. Android Studio'da açın

```
npm run app:android
```

Buradan emülatörde çalıştırabilir ya da imzalı APK/AAB üretebilirsiniz.

## Emülatörde yerel sunucuyla deneme

Yayına almadan denemek için, `npm run dev` çalışırken:

```
CAPACITOR_SERVER_URL="http://10.0.2.2:8080" npm run app:sync
npm run app:android
```

`10.0.2.2` Android emülatöründen bilgisayarınızın `localhost` adresidir.
iOS simülatöründe `http://localhost:8080` kullanılır.

## Kamera izinleri

Kamera zorunlu sınavlar kamerayı WebView içinden `getUserMedia` ile açıyor.
Android'de bu izinler manifest'te bildirilmeden istek **sessizce reddedilir**
ve öğrenci sınava hiç giremez. `android/app/src/main/AndroidManifest.xml`
içinde tanımlılar:

| İzin | Ne için |
|---|---|
| `INTERNET` | Uygulama içeriği sunucudan geliyor |
| `CAMERA` | Sınav gözetimi |
| `RECORD_AUDIO` | Mikrofon seviyesi göstergesi |
| `MODIFY_AUDIO_SETTINGS` | Ses akışının düzgün açılması |

`uses-feature` kayıtları `required="false"`: kamerası olmayan bir tablet de
kamerasız sınavlara girebilmeli, uygulama o cihazlara kapalı olmamalı.

## Native davranışlar

`components/shared/native-bridge.tsx` yalnızca Capacitor kabuğunda devreye
girer, tarayıcıda hiçbir şey yapmaz:

- **Durum çubuğu** arayüzle aynı temayı izler.
- **Açılış ekranı** uygulama hazır olunca kapanır.
- **Android geri tuşu** sayfalar arasında geri gider; uygulamanın kökündeyse
  uygulamayı kapatır. **Sınav sırasında çalışmaz** — öğrencinin yanlışlıkla
  sınavdan çıkmasını önlemek için.

## iOS

iOS projesi henüz üretilmedi; derlemek için Mac ve Xcode gerekiyor. Mac'e
geçtiğinizde:

```
npx cap add ios
CAPACITOR_SERVER_URL="https://<adresiniz>" npm run app:sync
npm run app:ios
```

`Info.plist` içine kamera ve mikrofon açıklamaları eklenmeli
(`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`) — Apple bu
metinler olmadan uygulamayı reddeder.

## Mağaza notu

Apple, yalnızca bir siteyi saran uygulamaları "minimum functionality"
gerekçesiyle reddedebiliyor. Bu riski azaltan native yetenekler zaten var
(kamera gözetimi, durum çubuğu, geri tuşu davranışı, açılış ekranı);
gerekirse push bildirim ve çevrimdışı sonuç görüntüleme eklenebilir.
