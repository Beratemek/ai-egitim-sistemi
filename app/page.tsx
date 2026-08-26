import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LandingPillNav } from "@/components/shared/landing-pill-nav";
import { LandingMotionController } from "@/components/shared/landing-motion-controller";
import { LandingProcessFlow } from "@/components/shared/landing-process-flow";
import { LandingRoleShowcase } from "@/components/shared/landing-role-showcase";
import { LandingRotatingMotto } from "@/components/shared/landing-rotating-motto";
import { LandingWorkflowOrbit } from "@/components/shared/landing-workflow-orbit";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRINCIPLES = ["Kaynağa dayalı", "İnsan onaylı", "Rol bazlı"] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <LandingPillNav />
      <LandingMotionController />

      <main>
        <section id="ana-sayfa" className="landing-hero relative overflow-hidden border-b">
          <div className="landing-paper-field absolute inset-0" aria-hidden />
          <div className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl grid-cols-1 gap-8 px-5 pb-14 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-stretch lg:gap-4 lg:pb-8 lg:pt-24">
            <div className="relative z-10 flex min-w-0 flex-col justify-center lg:py-14" data-landing-reveal data-landing-reveal-delay="1">
              <p className="landing-kicker">Ölçme ve değerlendirme, tek akışta.</p>
              <h1 className="mt-5 max-w-[11ch] font-sans text-[clamp(3.25rem,6.2vw,6.75rem)] font-semibold leading-[0.9] tracking-[-0.065em]">
                Öğrenmeyi
                <LandingRotatingMotto />
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
                    "specular-cta h-[3.25rem] rounded-xl px-6 shadow-[0_14px_28px_-14px_hsl(var(--primary)/0.65)]",
                  )}
                >
                  Sistemi keşfedin
                  <ArrowRight />
                </Link>
                <a className="group inline-flex items-center gap-2 border-b border-foreground/25 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary" href="#surec">
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

        <section id="surec" className="px-5 py-24 sm:px-8 sm:py-32" data-landing-reveal>
          <LandingProcessFlow />
        </section>

        <section id="roller" className="landing-roles-section border-t bg-muted/45 px-5 py-20 sm:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-end" data-landing-reveal>
              <div>
                <p className="landing-section-label">Çalışma alanları</p>
                <h2 className="mt-5 max-w-3xl font-display text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
                  Aynı sistem. Her role göre başka bir görünüm.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground lg:justify-self-end lg:text-right">
                İçerik uzmanından eğitim yöneticisine kadar herkes kendi sorumluluğuna odaklanır; veri ve süreç kopmadan devam eder.
              </p>
            </div>

            <div data-landing-reveal data-landing-reveal-delay="1">
              <LandingRoleShowcase />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
