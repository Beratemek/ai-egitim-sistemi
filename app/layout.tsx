import type { Metadata, Viewport } from "next";
import { Figtree, STIX_Two_Text } from "next/font/google";

import { NativeBridge } from "@/components/shared/native-bridge";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Baslik fontu.
 *
 * STIX Two Text eğitim ve yayıncılık tonunu korurken küçük başlıklarda da
 * rahat okunur. Gövde ve panel arayüzünde daha açık formlu Figtree kullanılır.
 */
const stix = STIX_Two_Text({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
      <body className={`${figtree.variable} ${stix.variable} min-h-screen bg-paper font-sans`}>
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
