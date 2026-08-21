import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SELECTABLE_ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

const PIPELINE: readonly { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: FileUp,
    title: "Icerik yuklenir",
    body: "Icerik uzmani kaynak metni ve kazanimi sisteme girer.",
  },
  {
    icon: BrainCircuit,
    title: "AI soru uretir",
    body: "Model kazanima uygun test ve acik uclu taslaklari sema zorlamali JSON olarak dondurur.",
  },
  {
    icon: ClipboardCheck,
    title: "Egitmen onaylar",
    body: "Taslaklar incelenir; onaylananlar soru havuzuna girer, digerleri reddedilir.",
  },
  {
    icon: GraduationCap,
    title: "Ogrenci cevaplar",
    body: "Sinav sirasinda acik uclu cevaplar toplanir.",
  },
  {
    icon: ShieldCheck,
    title: "AI puanlar, egitmen dogrular",
    body: "Cevap rubrige gore puanlanir; nihai puani her zaman egitmen onaylar.",
  },
  {
    icon: LineChart,
    title: "Yonetici raporlar",
    body: "Sinav bazli ortalama, katilim ve onay oranlari izlenir.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ---------- Ust cubuk ---------- */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
              Giris yap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Kahraman bolum ---------- */}
        <section className="relative overflow-hidden border-b">
          <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
          <div
            className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="soft" className="gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5" />
                Hackathon MVP
              </Badge>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
                Yapay Zeka Destekli{" "}
                <span className="text-primary">Egitim Sistemi</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Kazanimdan soruya, cevaptan puana kadar tum degerlendirme surecini
                yapay zeka ile hizlandirin — son sozu her zaman egitmen soylesin.
              </p>

              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "lg" }), "gap-2")}
                >
                  Hemen basla
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/egitmen/soru-havuzu"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "gap-2",
                  )}
                >
                  Soru havuzunu incele
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Roller ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Dort rol, dort panel
            </h2>
            <p className="mt-2 text-muted-foreground">
              Her kullanici yalnizca kendi isine odaklanan bir arayuz gorur.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SELECTABLE_ROLES.map((definition) => {
              const Icon = ROLE_ICONS[definition.role];

              return (
                <Link key={definition.role} href={definition.path} className="group">
                  <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-md">
                    <CardContent className="flex items-start gap-4 p-5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{definition.label}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {definition.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ---------- Akis ---------- */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Uctan uca akis
              </h2>
              <p className="mt-2 text-muted-foreground">
                Yapay zeka isin yorucu kismini yapar; karar insanda kalir.
              </p>
            </div>

            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((step, index) => {
                const Icon = step.icon;

                return (
                  <li key={step.title}>
                    <Card className="h-full">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="text-xs font-semibold tabular text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="mt-3 font-medium">{step.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <BrandMark />
          <p>Next.js &middot; Supabase &middot; AI SDK &middot; shadcn/ui</p>
        </div>
      </footer>
    </div>
  );
}
