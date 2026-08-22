import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor yapılandırması.
 *
 * NEDEN `server.url`?
 *
 * Bu uygulama baştan sona SUNUCU TARAFLIDIR: Server Component'ler, server
 * action'lar ve `middleware.ts` içindeki oturum/rol koruması. Capacitor'ün
 * alışıldık yolu olan statik dışa aktarım (`output: "export"`) bunların
 * hiçbirini çalıştıramaz - sayfalar boş çıkar, giriş ve yetki kontrolü
 * tümüyle devre dışı kalır.
 *
 * Bu yüzden native kabuk, YAYINDAKİ siteyi yükler. Sonuç: mağazadan
 * kurulan gerçek bir uygulama, ama içeriği sunucudan geliyor.
 *
 * BUNUN İKİ SONUCU VAR, ikisi de bilinerek kabul edildi:
 *   1. Uygulama İNTERNET İSTER. Çevrimdışı çalışmaz.
 *   2. Site yayına alınmadan uygulama derlenemez. `CAPACITOR_SERVER_URL`
 *      tanımlı değilse derleme bilinçli olarak durur - sessizce localhost'a
 *      düşüp telefonda "bağlanılamadı" ekranı vermektense.
 */

const sunucuAdresi = process.env.CAPACITOR_SERVER_URL;

if (!sunucuAdresi) {
  throw new Error(
    [
      "CAPACITOR_SERVER_URL tanimli degil.",
      "",
      "Native kabuk yayindaki siteyi yukler; once siteyi bir adrese",
      "cikarmalisiniz (or. Vercel). Sonra:",
      "",
      '  CAPACITOR_SERVER_URL="https://<adresiniz>" npm run app:sync',
      "",
      "Emulatorde yerel sunucuyla denemek icin:",
      "  Android emulator -> http://10.0.2.2:8080",
      "  iOS simulator    -> http://localhost:8080",
    ].join("\n"),
  );
}

const config: CapacitorConfig = {
  appId: "com.t3.aiegitim",
  appName: "AI Eğitim",

  /**
   * `server.url` kullanıldığında bu klasörün içeriği ekrana gelmez, ama
   * Capacitor yine de var olmasını ister. Ağ yokken gösterilen yedek sayfa
   * burada duruyor.
   */
  webDir: "capacitor/web",

  server: {
    url: sunucuAdresi,
    // Yayında HTTPS zorunlu; yerel denemede http'ye izin verilir.
    cleartext: sunucuAdresi.startsWith("http://"),
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#f5efe2",
      showSpinner: false,
    },
  },

  android: {
    // Kamera izni sinav sirasinda WebView icinden isteniyor.
    allowMixedContent: sunucuAdresi.startsWith("http://"),
  },

  ios: {
    contentInset: "always",
  },
};

export default config;
