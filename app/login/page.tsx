import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { LoginForm } from "@/components/shared/login-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";

export const metadata: Metadata = {
  title: "Giriş",
  description: "AI Destekli Eğitim Sistemi'ne giriş yapın.",
};

const HIGHLIGHTS: readonly string[] = [
  "Kazanımdan saniyeler içinde soru taslağı",
  "Açık uçlu cevaplara rubrik tabanlı otomatik puan",
  "Nihai karar her zaman eğitmende",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const callbackError = params.error ?? null;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- Sol: marka paneli (yalnızca genis ekran) ---------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        {/*
          Izgara + bulanik kure yerine kitap rafi. O ikili neredeyse her
          hazir sablonda var; raf ise urunun ne oldugunu soyluyor.
        */}
        <div className="bg-paper absolute inset-0 opacity-[0.12]" aria-hidden />
        <div
          className="bg-shelf pointer-events-none absolute inset-x-0 bottom-0 h-64 opacity-[0.22]"
          aria-hidden
        />

        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <span className="text-lg font-semibold">A</span>
            </span>
            <span className="text-sm font-semibold tracking-tight">
              AI Destekli Eğitim Sistemi
            </span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <h1 className="max-w-md font-display text-4xl leading-[1.12]">
            Değerlendirmenin yorucu kısmını yapay zekâya bırakın.
          </h1>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/85">
                <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Hackathon MVP &middot; Next.js + Supabase + AI SDK
        </p>
      </aside>

      {/* ---------- Sag: form ---------- */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Ana sayfa
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm space-y-8">
            <div className="lg:hidden">
              <BrandMark />
            </div>

            <div>
              <h2 className="font-display text-2xl">
                Hesabiniza giriş yapın
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Rolünüze uygun panel otomatik olarak açılır.
              </p>
            </div>

            <LoginForm callbackError={callbackError} />

            <p className="text-center text-xs text-muted-foreground">
              Sorun mu yasiyorsunuz?{" "}
              <code className="font-mono">supabase/schema.sql</code> dosyasinin
              calistirildigindan emin olun.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
