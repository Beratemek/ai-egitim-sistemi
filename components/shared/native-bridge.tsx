"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Native kabuk davranışları.
 *
 * Uygulama tarayıcıda açıldığında bu bileşen hiçbir şey yapmaz; yalnızca
 * Capacitor kabuğu içinde çalışırken devreye girer. Böylece tek kod tabanı
 * hem web hem uygulama olarak yaşayabiliyor.
 *
 * Capacitor eklentileri `import()` ile GEÇ yükleniyor: web derlemesine
 * native paketlerin girmesini engelliyor ve tarayıcıda gereksiz kod
 * indirilmesini önlüyor.
 */
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();

  /** Geri tuşunun hangi yolda ne yapacağını effect'e taşımadan tutuyoruz. */
  const yolRef = React.useRef(pathname);
  React.useEffect(() => {
    yolRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    let iptal = false;
    const temizleyiciler: Array<() => void> = [];

    async function kur() {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || iptal) return;

      /* ---------- Durum çubuğu ---------- */
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // Ekranın tepesindeki saat/pil satırı arayüzle aynı temayı izlesin.
        const koyu = document.documentElement.classList.contains("dark");
        await StatusBar.setStyle({ style: koyu ? Style.Dark : Style.Light });
      } catch {
        // Durum cubugu her cihazda ayarlanamayabilir; uygulama yine calisir.
      }

      /* ---------- Açılış ekranı ---------- */
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {
        // Splash zaten kapanmis olabilir.
      }

      /* ---------- Android geri tuşu ---------- */
      try {
        const { App } = await import("@capacitor/app");

        const dinleyici = await App.addListener("backButton", ({ canGoBack }) => {
          /*
            SINAV SIRASINDA GERI TUSU CALISMAZ.

            Android'de geri tusu varsayilan olarak uygulamayi kapatir.
            Sinav ekraninda bu, ogrencinin yanlislikla sinavdan cikmasi
            demek. Cikis yalnizca "Sinavi bitir" ya da sinav bilgilerine
            donme baglantisiyla olmali.
          */
          if (yolRef.current.startsWith("/sinav/")) return;

          if (canGoBack) {
            router.back();
          } else {
            void App.exitApp();
          }
        });

        temizleyiciler.push(() => void dinleyici.remove());
      } catch {
        // App eklentisi yoksa geri tusu varsayilan davranisinda kalir.
      }
    }

    void kur();

    return () => {
      iptal = true;
      for (const temizle of temizleyiciler) temizle();
    };
  }, [router]);

  return null;
}
