import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  Target,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { LandingBentoCanvas } from "@/components/shared/landing-bento-canvas";
import { LandingScrollStory } from "@/components/shared/landing-scroll-story";
import { ROLE_ICONS } from "@/components/shared/role-icons";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { SELECTABLE_ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

const FLOW_STEPS: readonly {
  number: string;
  title: string;
  description: string;
  width: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    number: "01",
    title: "Kazanımı belirle",
    description: "Kaynak, ders ve ölçülecek kazanım aynı yerde tanımlanır.",
    width: "lg:w-[58%]",
    icon: Target,
    tone: "bg-primary text-primary-foreground",
  },
  {
    number: "02",
    title: "Soruyu birlikte hazırla",
    description: "AI taslak üretir; içerik uzmanı ve eğitmen son hâlini verir.",
    width: "lg:w-[72%]",
    icon: BrainCircuit,
    tone: "bg-[#d7e7df] text-[#123d34] dark:bg-primary/25 dark:text-foreground",
  },
  {
    number: "03",
    title: "Sınavı uygula",
    description: "Öğrenci kendi panelinden sınava girer, cevaplar otomatik kaydolur.",
    width: "lg:w-[86%]",
    icon: GraduationCap,
    tone: "bg-[#f2d8c4] text-[#512f20] dark:bg-warning/25 dark:text-foreground",
  },
  {
    number: "04",
    title: "Sonucu onayla",
    description: "Rubrik tabanlı ön değerlendirme eğitmen kararıyla kesinleşir.",
    width: "lg:w-full",
    icon: CheckCircle2,
    tone: "bg-foreground text-background",
  },
];

const ROLE_VISUAL_STYLES = [
  "bg-[#dfeae4] text-[#173a36]",
  "bg-[#176f5e] text-[#fffaf0]",
  "bg-[#f3dfbd] text-[#34271e]",
  "bg-[#a9c4c4] text-[#173a36]",
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <nav className="mx-auto flex h-[4.75rem] min-w-0 max-w-[112rem] items-center gap-3 rounded-[1.45rem] border bg-background/95 px-5 shadow-[0_14px_38px_hsl(var(--foreground)/0.08)] backdrop-blur-md sm:h-[5.5rem] sm:px-8">
          <BrandMark className="shrink-0 [&>span:first-child]:h-11 [&>span:first-child]:w-11 [&>span:first-child]:rounded-[13px] [&>span:first-child>svg]:h-5 [&>span:first-child>svg]:w-5 [&>span:last-child]:hidden sm:[&>span:last-child]:flex sm:[&>span:last-child>span:first-child]:text-[17px] sm:[&>span:last-child>span:last-child]:text-xs" />
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/auth/signout-and-login?mode=giris"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "hidden h-12 rounded-full px-6 sm:inline-flex",
              )}
            >
              Giriş yap
            </Link>
            <Link
              href="/auth/signout-and-login?mode=kayit"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 rounded-full px-5 sm:px-7",
              )}
            >
              <span className="sm:hidden">Başla</span>
              <span className="hidden sm:inline">Hemen başla</span>
              <ArrowRight className="hidden h-4 w-4 sm:block" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="academic-hero relative overflow-hidden border-b pt-[5.5rem] sm:pt-[6.5rem]">
          <div className="academic-paper-field absolute inset-0" aria-hidden />

          <div className="relative mx-auto w-full pt-14 sm:pt-20 lg:pt-24">
            <div className="relative z-10 mx-auto flex max-w-[92rem] animate-kitap-yukselir flex-col items-center px-5 text-center sm:px-8">
              <h1 className="font-display text-[clamp(4.4rem,10vw,11.5rem)] leading-[0.76] tracking-[-0.06em]">
                Öğrenmeyi
                <span className="relative mx-auto mt-[0.08em] block w-fit text-primary">
                  görünür kıl.
                </span>
              </h1>

              <p className="mt-9 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                İçerikten değerlendirmeye kadar öğretmenin kontrolünde çalışan,
                öğrenmeyi izlenebilir kılan ölçme deneyimi.
              </p>

              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth/signout-and-login?mode=kayit"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-14 rounded-full px-9 text-base shadow-[0_10px_24px_hsl(var(--primary)/0.22)] transition-transform hover:-translate-y-0.5",
                  )}
                >
                  Başlayın
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#nasil-calisir"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "h-14 rounded-full border-primary/30 bg-background/80 px-9 text-base shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/60",
                  )}
                >
                  Nasıl çalışır?
                </a>
              </div>

              <div className="mt-8 flex items-start gap-3 text-left text-[10px] leading-4 text-muted-foreground">
                <span className="mt-1 font-display text-2xl leading-none text-[#c7795c]">*</span>
                <p className="max-w-sm">
                  Sistem ilişkiyi kurar, öneriyi hazırlar. Son karar her zaman eğitmendedir.
                </p>
              </div>
            </div>

            <div className="mt-14 w-full sm:mt-20">
              <LandingBentoCanvas />
            </div>
          </div>
        </section>

        <LandingScrollStory />

        <section id="nasil-calisir" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div className="lg:sticky lg:top-32 lg:self-start">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Nasıl çalışır?
                </p>
                <h2 className="mt-4 max-w-lg font-display text-4xl leading-tight sm:text-5xl">
                  Karmaşık süreç,
                  <br /> dört net adım.
                </h2>
                <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                  Her adımın sahibi ve çıktısı belli. Yapay zekâ süreci hızlandırır;
                  pedagojik kontrolü devralmaz.
                </p>
              </div>

              <ol className="space-y-4">
                {FLOW_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.number}
                      className={cn(
                        "ml-auto rounded-[1.5rem] p-5 shadow-sm sm:p-6",
                        step.width,
                        step.tone,
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/15 bg-white/20">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="font-sans text-lg font-semibold tracking-normal">
                              {step.title}
                            </h3>
                            <span className="text-xs font-semibold opacity-55 tabular">
                              {step.number}
                            </span>
                          </div>
                          <p className="mt-2 max-w-xl text-sm leading-relaxed opacity-75">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section id="roller" className="border-y bg-[#f3f1eb] px-5 py-24 dark:bg-card sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Dört rol, tek sistem
                </p>
                <h2 className="mt-4 font-display text-4xl sm:text-5xl">
                  Herkes yalnızca ihtiyacını görür.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-right">
                Rolünüzü seçin. Kayıt ve onay sürecinden sonra size ait çalışma
                alanı otomatik olarak açılsın.
              </p>
            </div>

            <div className="mt-12 space-y-6">
              {SELECTABLE_ROLES.map((definition, index) => {
                const Icon = ROLE_ICONS[definition.role];
                return (
                  <Link
                    key={definition.role}
                    href={`/auth/signout-and-login?mode=kayit&role=${definition.role}`}
                    className="group grid min-h-[24rem] overflow-hidden rounded-[2rem] bg-background shadow-[0_18px_55px_hsl(var(--foreground)/0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_65px_hsl(var(--foreground)/0.12)] lg:grid-cols-[1.05fr_0.95fr]"
                  >
                    <span className="flex min-h-[22rem] flex-col p-7 sm:p-10 lg:min-h-[26rem] lg:p-12">
                      <span className="block max-w-xl font-display text-4xl leading-[0.95] sm:text-6xl">
                        {definition.label} paneli
                      </span>

                      <span className="mt-auto block max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                        {definition.description}
                      </span>

                      <span className="mt-8 flex w-fit items-center gap-3 rounded-full bg-[#111318] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_9px_24px_rgb(17_19_24/0.2)] transition-all group-hover:gap-5 group-hover:bg-primary sm:text-base">
                        Bu rolle başlayın
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </span>

                    <span
                      className={cn(
                        "relative flex min-h-[20rem] items-center justify-center overflow-hidden p-8 lg:min-h-[26rem]",
                        ROLE_VISUAL_STYLES[index],
                      )}
                    >
                      <span className="absolute left-6 top-6 rounded-full bg-white/75 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#173a36]">
                        {definition.label}
                      </span>
                      <span className="relative flex h-40 w-40 rotate-[-3deg] items-center justify-center rounded-[2.25rem] bg-white/25 shadow-[0_24px_55px_rgb(16_39_47/0.12)] backdrop-blur-sm transition-transform duration-500 group-hover:rotate-[2deg] group-hover:scale-105 sm:h-52 sm:w-52">
                        <Icon className="h-20 w-20 sm:h-28 sm:w-28" strokeWidth={1.15} />
                      </span>
                      <span className="absolute bottom-7 right-7 font-display text-2xl opacity-55">
                        Çalışma alanı
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-primary p-7 text-primary-foreground sm:p-12 lg:flex-row lg:items-end">
            <div>
              <UsersRound className="h-6 w-6 text-primary-foreground/65" />
              <h2 className="mt-6 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">
                Değerlendirmeyi yük olmaktan çıkarın.
              </h2>
            </div>
            <Link
              href="/auth/signout-and-login?mode=kayit"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "h-12 shrink-0 rounded-full px-6",
              )}
            >
              Kayıt oluşturun
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <BrandMark />
          <p>Yapay zekâ hızlandırır, eğitmen karar verir.</p>
        </div>
      </footer>
    </div>
  );
}
