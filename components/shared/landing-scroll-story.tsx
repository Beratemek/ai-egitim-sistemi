"use client";

import * as React from "react";

const WORDS = ["Kazanımı", "soruya,", "cevabı", "güvenilir", "sonuca", "dönüştür."];

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function LandingScrollStory() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const frameRef = React.useRef<number | null>(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    function measure() {
      frameRef.current = null;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const distance = Math.max(section.offsetHeight - window.innerHeight, 1);
      // Hareket sticky alan ekrana oturmadan hemen once baslar. Onceki 38vw
      // mesafesi genis ekranda kelimeleri tamamen disari atiyordu.
      setProgress(clamp((-rect.top + window.innerHeight * 0.18) / distance));
    }

    function requestMeasure() {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", requestMeasure, { passive: true });
    window.addEventListener("resize", requestMeasure);

    return () => {
      window.removeEventListener("scroll", requestMeasure);
      window.removeEventListener("resize", requestMeasure);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <section id="akis" ref={sectionRef} className="relative h-[220vh] border-y bg-card">
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden px-5 py-24 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <p className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Tek ve izlenebilir bir akış
          </p>

          <div className="flex max-w-5xl flex-wrap gap-x-[0.22em] gap-y-2 font-display text-[clamp(2.8rem,7vw,7.4rem)] leading-[0.93] tracking-[-0.045em]">
            {WORDS.map((word, index) => {
              const start = index * 0.055;
              const localProgress = clamp((progress - start) / 0.4);

              /*
                Hareket YALNIZCA DIKEY.

                Onceki surum kelimeleri yatayda +/-14vw kaydiriyordu. Yatay
                oteleme kardes elemanlari itmez - kelime kendi yerinde durur,
                yalnizca boyanacagi yer kayar. Sonuc: "Kazanimi" ile "soruya,"
                efektin ortasinda ust uste biniyor ve okunmaz oluyordu. 14vw
                zaten bir kere 38vw'den dusurulmus, ama sorun mesafede degil
                yonde: uzun Turkce kelimeler ne kadar kaydirilirsa kaydirilsin
                cakisiyor.

                Dikey oteleme boyle bir sorun uretmiyor - satir yuksekligi
                sabit, kelimeler kendi sutununda yukari dogru geliyor. Ayni
                kademeli aciliş hissi kaliyor, cakisma bitiyor.
              */
              const lift = (1 - localProgress) * (index % 2 === 0 ? 46 : 30);
              const blur = (1 - localProgress) * 5;

              return (
                <span
                  key={word}
                  className={
                    word === "güvenilir"
                      ? "rounded-[0.18em] bg-accent px-[0.12em] text-accent-foreground"
                      : ""
                  }
                  style={{
                    opacity: 0.12 + localProgress * 0.88,
                    transform: `translate3d(0, ${lift}px, 0)`,
                    filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
                    transition: "opacity 80ms linear, filter 80ms linear",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          <p
            className="mt-10 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            style={{ opacity: clamp((progress - 0.72) / 0.18) }}
          >
            Yapay zekâ hız kazandırır. Rubrik ölçütleri açıklar. Nihai kararı
            ise her zaman eğitmen verir.
          </p>
        </div>
      </div>
    </section>
  );
}
