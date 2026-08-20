import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { LoginForm } from "@/components/shared/login-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";

export const metadata: Metadata = {
  title: "Giris",
  description: "AI Destekli Egitim Sistemi'ne giris yapin.",
};

const HIGHLIGHTS: readonly string[] = [
  "Kazanimdan saniyeler icinde soru taslagi",
  "Acik uclu cevaplara rubrik tabanli otomatik puan",
  "Nihai karar her zaman egitmende",
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
      {/* ---------- Sol: marka paneli (yalnizca genis ekran) ---------- */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="bg-grid absolute inset-0 opacity-[0.07]" aria-hidden />
        <div
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <span className="text-lg font-semibold">A</span>
            </span>
            <span className="text-sm font-semibold tracking-tight">
              AI Destekli Egitim Sistemi
            </span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Degerlendirmenin yorucu kismini yapay zekaya birakin.
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
              <h2 className="text-2xl font-semibold tracking-tight">
                Hesabiniza giris yapin
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Rolunuze uygun panel otomatik olarak acilir.
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
