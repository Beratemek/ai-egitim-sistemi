"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/shared/brand-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { smoothScrollToHash } from "@/lib/smooth-scroll";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "#ana-sayfa", id: "ana-sayfa", label: "Ana Sayfa" },
  { href: "#surec", id: "surec", label: "Süreç" },
  { href: "#roller", id: "roller", label: "Roller" },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]["id"];

export function LandingPillNav() {
  const [activeSection, setActiveSection] = useState<SectionId>("ana-sayfa");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const marker = window.scrollY + window.innerHeight * 0.34;
      let nextSection: SectionId = "ana-sayfa";

      for (const item of NAV_ITEMS) {
        const section = document.getElementById(item.id);
        if (section && section.offsetTop <= marker) nextSection = item.id;
      }

      setActiveSection(nextSection);
      setScrolled(window.scrollY > 28);
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <header
      className="landing-site-header pointer-events-none fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6 lg:top-5 lg:px-8"
      data-scrolled={scrolled}
    >
      <nav aria-label="Ana navigasyon" className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="landing-brand-island pointer-events-auto rounded-xl px-3 py-2">
          <BrandMark />
        </div>

        <div className="pointer-events-auto flex min-w-0 items-center gap-2">
          <div className="landing-pill-bar">
            <div className="hidden items-center gap-1 lg:flex" role="list">
              {NAV_ITEMS.map((item) => {
                const active = item.id === activeSection;
                return (
                  <a
                    key={item.id}
                    aria-current={active ? "location" : undefined}
                    className="landing-pill-link"
                    data-active={active}
                    href={item.href}
                    /*
                      Tarayicinin ANINDA zipladigi davranis birakildi.

                      Duz bir `<a href="#...">` hedefe hic kaydirmadan
                      konumlaniyordu; "sayfa zipladi" hissi veriyor ve
                      kullanici nereye geldigini takip edemiyordu. Artik
                      olcülü, sonda yavaslayan bir kaydirma var.

                      preventDefault yalnizca hedef BULUNURSA: bolum
                      silinmisse tarayicinin kendi davranisi calissin.

                      Adres cubugundaki karma pushState ile guncellenir -
                      dogrudan yazmak tarayiciyi yeniden ziplatirdi.
                    */
                    onClick={(event) => {
                      setActiveSection(item.id);

                      const nav = event.currentTarget.closest("header, nav");
                      const bosluk = (nav?.getBoundingClientRect().height ?? 64) + 24;

                      if (smoothScrollToHash(item.href, { offset: bosluk })) {
                        event.preventDefault();
                        window.history.pushState(null, "", item.href);
                      }
                    }}
                    role="listitem"
                  >
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>

            <Link
              href="/auth/signout-and-login?mode=kayit"
              className={cn(buttonVariants({ variant: "ghost" }), "hidden rounded-full px-4 sm:inline-flex")}
            >
              Kayıt Ol
            </Link>
            {/*
              Etiket bilerek "Giriş Yap": "Çalışma alanını aç" ziyaretçiye giriş
              noktasi gibi okunmuyordu - ana sayfadaki TEK giris baglantisi bu.
              Hedef /dashboard degil /login?mode=giris: /dashboard yalnizca
              middleware yonlendirmesiyle giris ekranina dusuyordu, bu yol ise
              formu dogrudan giris kipinde acar. Oturum zaten aciksa middleware
              (bkz. middleware.ts, "Oturum acikken /login") kullaniciyi kendi
              paneline gonderir; buton her iki durumda da dogru yere gider.
            */}
            <Link
              href="/login?mode=giris"
              className={cn(buttonVariants(), "specular-cta h-10 rounded-full px-4 sm:px-5")}
            >
              <span className="sm:hidden">Giriş</span>
              <span className="hidden sm:inline">Giriş Yap</span>
              <ArrowRight />
            </Link>
          </div>

          <div className="landing-theme-island" aria-label="Görünüm ayarı">
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
}
