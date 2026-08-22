import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BookshelfBackdrop } from "@/components/shared/bookshelf-backdrop";
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
    title: "İçerik yüklenir",
    body: "İçerik uzmanı kaynak metni ve kazanımı sisteme girer.",
  },
  {
    icon: BrainCircuit,
    title: "AI soru üretir",
    body: "Model kazanıma uygun test ve açık uçlu taslakları şema zorlamalı JSON olarak döndürür.",
  },
  {
    icon: ClipboardCheck,
    title: "Eğitmen onaylar",
    body: "Taslaklar incelenir; onaylananlar soru havuzuna girer, diğerleri reddedilir.",
  },
  {
    icon: GraduationCap,
    title: "Öğrenci cevaplar",
    body: "Sınav sırasında açık uçlu cevaplar toplanır.",
  },
  {
    icon: ShieldCheck,
    title: "AI puanlar, eğitmen doğrular",
    body: "Cevap rubriğe göre puanlanır; nihai puanı her zaman eğitmen onaylar.",
  },
  {
    icon: LineChart,
    title: "Yönetici raporlar",
    body: "Sınav bazlı ortalama, katılım ve onay oranları izlenir.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ---------- Üst cubuk ---------- */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "gap-2")}>
              Giriş yap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Kahraman bolum ---------- */}
        {/*
          Duzen bilerek ASIMETRIK: ortalanmis baslik + arkasinda dairesel
          parlama, hazir sablonlarin en tanidik kalibi. Burada metin solda,
          gorsel anlati sagda; altta ise kitap rafi duruyor.
        */}
        <section className="relative overflow-hidden border-b">
          <div className="bg-paper absolute inset-0 opacity-70" aria-hidden />
          <BookshelfBackdrop className="opacity-90" />

          <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-16 sm:px-6 sm:pb-52 sm:pt-24">
            <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
              <div>
                <Badge variant="soft" className="gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Ölçme &amp; değerlendirme platformu
                </Badge>

                <h1 className="mt-5 font-display text-4xl leading-[1.08] sm:text-6xl">
                  Kazanımdan soruya,
                  <br />
                  cevaptan{" "}
                  <span className="marker font-semibold">puana</span> kadar
                </h1>

                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Yapay zekâ soruyu üretir, açık uçlu cevabı rubriğe göre
                  puanlar; son sözü her zaman eğitmen söyler. Siz derse
                  odaklanın, kırtasiyeyi sistem üstlensin.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ size: "lg" }), "gap-2")}
                  >
                    Hemen başla
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

              {/*
                Sag sutun: urunun vaadini rakamla anlatan kucuk bir kunye.
                Ekran goruntusu koymak yerine metin secildi - sahte bir
                arayuz gorseli urunu oldugundan buyuk gosterirdi.
              */}
              <Card className="border-2 shadow-sm">
                <CardContent className="space-y-5 p-6">
                  <p className="font-display text-xl">Nasıl işliyor?</p>

                  <ol className="space-y-4">
                    {PIPELINE.slice(0, 4).map((step, index) => (
                      <li key={step.title} className="flex gap-3">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular">
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            {step.title}
                          </span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                            {step.body}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>

                  <p className="border-t pt-4 text-sm text-muted-foreground">
                    Kalan adımlar aşağıda.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ---------- Roller ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl">
              Dört rol, dört panel
            </h2>
            <p className="mt-2 text-muted-foreground">
              Her kullanıcı yalnızca kendi işine odaklanan bir arayüz görür.
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
              <h2 className="font-display text-2xl sm:text-3xl">
                Uçtan uca akış
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
