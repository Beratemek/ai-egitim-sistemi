"use client";

import Checklist from "@solar-icons/react/ssr/list/Checklist";
import ClipboardCheck from "@solar-icons/react/ssr/notes/ClipboardCheck";
import DocumentText from "@solar-icons/react/ssr/notes/DocumentText";
import SquareAcademicCap from "@solar-icons/react/ssr/school/SquareAcademicCap";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const PROCESS_STEPS = [
  {
    number: "01",
    title: "Kaynağı ve kazanımı tanımla",
    description: "Ders içeriğini yükleyin; hangi kazanımın, hangi düzeyde ölçüleceğini netleştirin.",
    outcome: "Çıktı: kaynakla ilişkilendirilmiş ölçme planı",
    icon: DocumentText,
  },
  {
    number: "02",
    title: "Soruyu ve rubriği hazırla",
    description: "Soru taslaklarını düzenleyin, puanlama ölçütlerini belirleyin ve havuza alın.",
    outcome: "Çıktı: eğitmen kontrolüne hazır soru seti",
    icon: Checklist,
  },
  {
    number: "03",
    title: "Sınavı sınıfla buluştur",
    description: "Sınavı planlayın, sınıfa atayın ve öğrencinin kesintisiz biçimde tamamlamasını sağlayın.",
    outcome: "Çıktı: güvenli biçimde toplanmış öğrenci yanıtları",
    icon: SquareAcademicCap,
  },
  {
    number: "04",
    title: "Kararı ver, gelişimi izle",
    description: "Ön değerlendirmeyi eğitmen onayıyla kesinleştirin; sınıf ve kazanım gelişimini izleyin.",
    outcome: "Çıktı: eyleme dönüşen ölçme ve gelişim içgörüsü",
    icon: ClipboardCheck,
  },
] as const;

type Connector = {
  height: number;
  path: string;
  targetX: number;
  targetY: number;
  width: number;
};

export function LandingProcessFlow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [connector, setConnector] = useState<Connector | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeStep = PROCESS_STEPS[activeIndex] ?? PROCESS_STEPS[0]!;
  const ActiveIcon = activeStep.icon;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const hub = hubRef.current;
    const target = itemRefs.current[activeIndex];
    if (!root || !hub || !target) return;

    const measure = () => {
      const rootBounds = root.getBoundingClientRect();
      const hubBounds = hub.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      const startX = hubBounds.right - rootBounds.left;
      const startY = hubBounds.top - rootBounds.top + hubBounds.height / 2;
      const targetX = targetBounds.left - rootBounds.left;
      const targetY = targetBounds.top - rootBounds.top + targetBounds.height / 2;
      const bend = Math.max(48, (targetX - startX) * 0.46);

      setConnector({
        height: rootBounds.height,
        path: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${targetX - bend} ${targetY}, ${targetX} ${targetY}`,
        targetX,
        targetY,
        width: rootBounds.width,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(hub);
    observer.observe(target);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [activeIndex]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mx-auto max-w-3xl text-center">
        <p className="landing-section-label justify-center">Süreç</p>
        <h2 className="mt-5 font-display text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">
          Ölçme yalnızca sonuç değil, birbirini besleyen bir yolculuk.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          Kaynak, soru, sınav ve değerlendirme aynı kayıt üzerinde ilerler. Bir adıma dokunun; kararın sonraki aşamaya nasıl taşındığını görün.
        </p>
      </div>

      <div ref={rootRef} className="process-flow-canvas mt-14 sm:mt-16">
        {connector ? (
          <svg
            aria-hidden="true"
            className="process-connector"
            height={connector.height}
            viewBox={`0 0 ${connector.width} ${connector.height}`}
            width={connector.width}
          >
            <path className="process-connector-path" d={connector.path} pathLength="1" />
            <circle className="process-connector-dot" cx={connector.targetX} cy={connector.targetY} r="4" />
          </svg>
        ) : null}

        <div ref={hubRef} className="process-hub" aria-live="polite">
          <div className="process-hub-topline">
            <span>{activeStep.number}</span>
            <ActiveIcon aria-hidden className="h-7 w-7" weight="LineDuotone" />
          </div>
          <h3>{activeStep.title}</h3>
          <p>{activeStep.description}</p>
          <span className="process-outcome">{activeStep.outcome}</span>
        </div>

        <ol className="process-step-list">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = step.icon;
            const active = index === activeIndex;
            return (
              <li key={step.number}>
                <button
                  ref={(node) => { itemRefs.current[index] = node; }}
                  aria-pressed={active}
                  className="process-step"
                  data-active={active}
                  onClick={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{ "--step-order": index } as CSSProperties}
                  type="button"
                >
                  <span className="process-step-number">{step.number}</span>
                  <span className="process-step-copy">
                    <strong>{step.title}</strong>
                    <small>{step.outcome.replace("Çıktı: ", "")}</small>
                  </span>
                  <Icon aria-hidden className="process-step-icon" weight="LineDuotone" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
