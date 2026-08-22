import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";

import { NativeBridge } from "@/components/shared/native-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Baslik fontu.
 *
 * Fraunces degisken bir serif: optik boyut ekseni sayesinde buyuk
 * basliklarda karakterli, kucuk boyutlarda okunakli duruyor. Tek fontlu
 * arayuz tarafsiz ama karaktersiz olurdu; serif baslik urune kitap sayfasi
 * tonu veriyor.
 */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Destekli Eğitim Sistemi",
    template: "%s | AI Destekli Eğitim Sistemi",
  },
  description:
    "Yapay zeka ile soru üreten, açık uçlu cevapları rubriğe göre puanlayan ve eğitmen onayıyla çalışan ölçme-değerlendirme platformu.",
};

/**
 * Mobil goruntu alani.
 *
 * `viewportFit: "cover"` centikli ekranlarda sayfanin kenarlara kadar
 * uzanmasini saglar; guvenli alan bosluklari CSS'te `env(safe-area-inset-*)`
 * ile veriliyor. Bu tanim olmadan native kabukta ust serit centigin altinda
 * kaliyordu.
 *
 * Yakinlastirma KAPATILMADI: sinavda kucuk yazi okuyan ogrencinin buyutme
 * hakki, denetim kaygisindan once gelir.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(42 36% 96%)" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(202 42% 8%)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} min-h-screen bg-paper font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NativeBridge />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
