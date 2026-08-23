import Checklist from "@solar-icons/react/ssr/list/Checklist";
import ClipboardCheck from "@solar-icons/react/ssr/notes/ClipboardCheck";
import DocumentText from "@solar-icons/react/ssr/notes/DocumentText";
import SquareAcademicCap from "@solar-icons/react/ssr/school/SquareAcademicCap";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { LandingRoleShowcase } from "@/components/shared/landing-role-showcase";
import { LandingWorkflowOrbit } from "@/components/shared/landing-workflow-orbit";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FLOW_STEPS = [
  {
    number: "01",
    title: "Kaynak ve kazanım",
    description: "Ders içeriğini yükleyin; hangi kazanımın, hangi düzeyde ölçüleceğini belirleyin.",
    icon: DocumentText,
  },
  {
    number: "02",
    title: "Soru ve rubrik",
    description: "Kaynağa bağlı soru taslaklarını hazırlayın, rubriği düzenleyin ve havuza alın.",
    icon: Checklist,
  },
  {
    number: "03",
    title: "Sınav deneyimi",
    description: "Sınavı sınıfa atayın; öğrencinin güvenli ve kesintisiz biçimde tamamlamasını sağlayın.",
    icon: SquareAcademicCap,
  },
  {
    number: "04",
    title: "Kontrol ve gelişim",
    description: "Ön değerlendirmeyi eğitmen kararıyla kesinleştirin, gelişimi sınıf ve kazanım düzeyinde izleyin.",
    icon: ClipboardCheck,
  },
] as const;

const PRINCIPLES = ["Kaynağa dayalı", "İnsan onaylı", "Rol bazlı"] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6 lg:top-5 lg:px-8">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="pointer-events-auto rounded-xl border bg-background/88 px-3 py-2 shadow-[0_8px_24px_-14px_hsl(var(--foreground)/0.3)] backdrop-blur-xl">
            <BrandMark />
          </div>

          <div className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/88 p-1.5 shadow-[0_8px_24px_-14px_hsl(var(--foreground)/0.3)] backdrop-blur-xl sm:gap-1.5">
            <a className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block" href="#nasil-calisir">
              Nasıl çalışır?
            </a>
            <a className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block" href="#roller">
              Roller
            </a>
            <ThemeToggle />
            <Link
              href="/auth/signout-and-login?mode=giris"
              className={cn(buttonVariants({ variant: "ghost" }), "hidden rounded-full px-4 sm:inline-flex")}
            >
              Giriş yap
            </Link>
            <Link
              href="/auth/signout-and-login?mode=kayit"
              className={cn(buttonVariants(), "rounded-full px-4 sm:px-5")}
            >
              <span className="sm:hidden">Başla</span>
              <span className="hidden sm:inline">Çalışma alanını aç</span>
              <ArrowRight />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero relative overflow-hidden border-b">
          <div className="landing-paper-field absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl grid-cols-1 gap-8 px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-4 lg:pb-8 lg:pt-24">
            <div className="relative z-10 flex min-w-0 flex-col justify-center lg:py-14">
              <p className="landing-kicker">Ölçme ve değerlendirme, tek akışta.</p>
              <h1 className="mt-5 max-w-[11ch] font-sans text-[clamp(3.25rem,6.2vw,6.75rem)] font-semibold leading-[0.9] tracking-[-0.065em]">
                Öğrenmeyi
                <span className="mt-1 block font-display font-medium italic tracking-[-0.045em] text-primary">görünür kıl.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Soru hazırlama, sınav, değerlendirme ve gelişim takibi. Her rol için ayrı bir çalışma alanı;
                tüm eğitim süreci için ortak bir düzen.
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/auth/signout-and-login?mode=kayit"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-[3.25rem] rounded-xl px-6 shadow-[0_14px_28px_-14px_hsl(var(--primary)/0.65)]",
                  )}
                >
                  Sistemi keşfedin
                  <ArrowRight />
                </Link>
                <a className="group inline-flex items-center gap-2 border-b border-foreground/25 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary" href="#nasil-calisir">
                  Süreci inceleyin
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>

              <div className="mt-12 flex flex-wrap border-y border-border/70 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:mt-14">
                {PRINCIPLES.map((item) => (
                  <span key={item} className="mr-4 border-r pr-4 last:mr-0 last:border-0 last:pr-0">{item}</span>
                ))}
              </div>
            </div>

            <LandingWorkflowOrbit />
          </div>
        </section>

        <section id="nasil-calisir" className="scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
              <div className="lg:sticky lg:top-32 lg:self-start">
                <p className="landing-section-label">Süreç</p>
                <h2 className="mt-5 max-w-lg font-display text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                  Dört adım.
                  <br /> Tek, kesintisiz kayıt.
                </h2>
                <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
                  Her aşamanın sahibi ve çıktısı belli. Sistem işleri birbirine bağlar; eğitim kararının sahibi değişmez.
                </p>
              </div>

              <ol className="border-t border-foreground/20">
                {FLOW_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.number} className="group grid grid-cols-[2.75rem_1fr_auto] gap-4 border-b border-foreground/20 py-7 sm:grid-cols-[4rem_1fr_auto] sm:gap-6 sm:py-9">
                      <span className="font-mono text-[11px] text-primary">{step.number}</span>
                      <div>
                        <h3 className="font-sans text-lg font-semibold tracking-[-0.02em] sm:text-xl">{step.title}</h3>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                      <Icon className="h-7 w-7 text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-4deg] sm:h-8 sm:w-8" weight="LineDuotone" />
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section id="roller" className="scroll-mt-24 border-y bg-muted/45 px-5 py-24 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-end">
              <div>
                <p className="landing-section-label">Çalışma alanları</p>
                <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                  Aynı sistem. Her role göre başka bir görünüm.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground lg:justify-self-end lg:text-right">
                İçerik uzmanından öğrenciye kadar herkes yalnızca kendi işine odaklanır; veri ve süreç kopmadan devam eder.
              </p>
            </div>

            <LandingRoleShowcase />
          </div>
        </section>

        <section className="border-b px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <h2 className="max-w-4xl font-display text-4xl leading-[1.02] sm:text-6xl lg:text-7xl">
              Değerlendirme yükünü azaltın. Öğrenciyi daha yakından izleyin.
            </h2>
            <div className="border-l border-foreground/20 pl-6">
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                Ekibiniz aynı akışta çalışsın; öğrencinin gelişimi sınav sonuçlarının arasında kaybolmasın.
              </p>
              <Link
                href="/auth/signout-and-login?mode=kayit"
                className={cn(buttonVariants({ size: "lg" }), "mt-6 rounded-xl px-6")}
              >
                Çalışma alanını aç
                <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
          <BrandMark />
          <div className="sm:text-right">
            <p>Ölçme, değerlendirme ve gelişim tek çalışma alanında.</p>
            <a
              className="mt-1 inline-block text-[10px] opacity-60 transition-opacity hover:opacity-100"
              href="https://www.figma.com/community/file/1166831539721848736"
              rel="noreferrer"
              target="_blank"
            >
              Solar Icons · 480 Design · CC BY 4.0
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
