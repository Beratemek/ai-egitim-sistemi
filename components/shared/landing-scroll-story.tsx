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
              const direction = index % 2 === 0 ? -1 : 1;
              const distance = (1 - localProgress) * direction * 14;
              const lift = (1 - localProgress) * (index % 3 === 0 ? 12 : -8);

              return (
                <span
                  key={word}
                  className={
                    word === "güvenilir"
                      ? "rounded-[0.18em] bg-accent px-[0.12em] text-accent-foreground"
                      : ""
                  }
                  style={{
                    opacity: 0.2 + localProgress * 0.8,
                    transform: `translate3d(${distance}vw, ${lift}px, 0)`,
                    transition: "opacity 80ms linear",
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
