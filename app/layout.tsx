import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";

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
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
