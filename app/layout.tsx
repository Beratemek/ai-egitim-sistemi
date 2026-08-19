import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Destekli Egitim Sistemi",
    template: "%s | AI Destekli Egitim Sistemi",
  },
  description:
    "Yapay zeka ile soru ureten, acik uclu cevaplari rubrige gore puanlayan ve egitmen onayiyla calisan olcme-degerlendirme platformu.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
