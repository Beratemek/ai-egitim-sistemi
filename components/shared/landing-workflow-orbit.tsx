"use client";

import Chart2 from "@solar-icons/react/ssr/business/Chart2";
import GraphUp from "@solar-icons/react/ssr/business/GraphUp";
import Checklist from "@solar-icons/react/ssr/list/Checklist";
import ClipboardCheck from "@solar-icons/react/ssr/notes/ClipboardCheck";
import DocumentText from "@solar-icons/react/ssr/notes/DocumentText";
import Book2 from "@solar-icons/react/ssr/school/Book2";
import SquareAcademicCap from "@solar-icons/react/ssr/school/SquareAcademicCap";
import Calendar from "@solar-icons/react/ssr/time/Calendar";
import ClockCircle from "@solar-icons/react/ssr/time/ClockCircle";
import UserCheckRounded from "@solar-icons/react/ssr/users/UserCheckRounded";
import UsersGroupRounded from "@solar-icons/react/ssr/users/UsersGroupRounded";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const CARD_COUNT = 7;
const INITIAL_PROGRESS = 0.357;
const AUTO_SPEED = 0.000016;

type ProductCardProps = {
  children: ReactNode;
  className: string;
  label: string;
};

function ProductCard({ children, className, label }: ProductCardProps) {
  return (
    <article aria-label={label} className={`workflow-orbit-card ${className}`}>
      <div className="workflow-orbit-card-inner">{children}</div>
    </article>
  );
}

function SourcePanel() {
  return (
    <ProductCard className="workflow-card--source" label="Kaynak kütüphanesi önizlemesi">
      <header className="workflow-card-header border-foreground/10">
        <span className="workflow-card-icon bg-primary/10 text-primary">
          <Book2 size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Kaynak kütüphanesi</strong>
          <small>Fen Bilimleri · 8. sınıf</small>
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">03 DOSYA</span>
      </header>
      <div className="space-y-2.5 p-5">
        {[
          ["Hücre ve Bölünmeler", "24 sayfa", "İşlendi"],
          ["DNA ve Genetik Kod", "18 sayfa", "İşlendi"],
          ["Basınç", "12 sayfa", "Yeni"],
        ].map(([name, pages, status], index) => (
          <div key={name} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b border-foreground/10 pb-2.5 last:border-0">
            <span className="flex h-9 w-9 items-center justify-center bg-background/60 text-primary">
              <DocumentText size={19} weight="LineDuotone" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs font-semibold">{name}</strong>
              <small className="mt-0.5 block text-[10px] text-muted-foreground">{pages}</small>
            </span>
            <span className={index === 2 ? "text-primary" : "text-muted-foreground"}>{status}</span>
          </div>
        ))}
      </div>
    </ProductCard>
  );
}

function QuestionPanel() {
  return (
    <ProductCard className="workflow-card--question" label="Soru düzenleyici önizlemesi">
      <header className="workflow-card-header">
        <span className="workflow-card-icon bg-primary text-primary-foreground">
          <Checklist size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Soru düzenleyici</strong>
          <small>Hücre ve Bölünmeler</small>
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">04 / 12</span>
      </header>
      <div className="p-4">
        <div className="flex items-center justify-between border-b pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span>Açık uçlu</span>
          <span>10 puan</span>
        </div>
        <p className="mt-3 max-w-[32rem] font-display text-lg font-medium leading-snug sm:text-xl">
          Mitoz bölünmenin canlılar için önemini iki örnekle açıklayın.
        </p>
        <div className="mt-3 grid grid-cols-3 border">
          {[
            ["Kavram", "4"],
            ["Gerekçe", "4"],
            ["Açıklık", "2"],
          ].map(([label, value]) => (
            <div key={label} className="border-r p-2.5 last:border-0">
              <span className="block text-[9px] text-muted-foreground">{label}</span>
              <strong className="mt-1 block text-sm tabular">{value} puan</strong>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Kaynakla eşleşti
          </span>
          <span className="bg-foreground px-2.5 py-1.5 text-[10px] font-semibold text-background">İncelemeye hazır</span>
        </div>
      </div>
    </ProductCard>
  );
}

function ExamPanel() {
  return (
    <ProductCard className="workflow-card--exam" label="Sınav planlama önizlemesi">
      <header className="workflow-card-header">
        <span className="workflow-card-icon bg-primary text-primary-foreground">
          <Calendar size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Sınav planı</strong>
          <small>8-A · Fen Bilimleri</small>
        </span>
        <span className="ml-auto text-[10px] font-semibold text-primary">YAYINDA</span>
      </header>
      <div className="grid grid-cols-[1fr_0.9fr] gap-4 p-5">
        <div>
          <p className="font-display text-2xl font-medium leading-tight">Konu değerlendirme</p>
          <div className="mt-6 space-y-3 text-xs">
            <span className="flex items-center gap-2"><Calendar size={17} weight="Linear" /> 26 Ağustos</span>
            <span className="flex items-center gap-2"><ClockCircle size={17} weight="Linear" /> 14:30 · 40 dk.</span>
            <span className="flex items-center gap-2"><UsersGroupRounded size={17} weight="Linear" /> 28 öğrenci</span>
          </div>
        </div>
        <div className="flex flex-col justify-between border-l border-border pl-4">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Kapsam</span>
          <strong className="text-4xl font-semibold tabular">12</strong>
          <span className="text-xs text-muted-foreground">8 test · 4 açık uçlu</span>
        </div>
      </div>
    </ProductCard>
  );
}

function ReviewPanel() {
  return (
    <ProductCard className="workflow-card--review" label="Eğitmen değerlendirme önizlemesi">
      <header className="workflow-card-header">
        <span className="workflow-card-icon bg-primary/10 text-primary">
          <ClipboardCheck size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Eğitmen kontrolü</strong>
          <small>Açık uçlu cevap · 07</small>
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">1 / 18</span>
      </header>
      <div className="grid grid-cols-[1fr_auto] gap-5 p-5">
        <div>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Öğrenci cevabı</span>
          <p className="mt-2 text-xs leading-relaxed text-foreground/75">
            Mitoz büyümeyi ve yaraların onarılmasını sağlar. Tek hücreli canlılarda üremeye yardımcı olur.
          </p>
          <div className="mt-4 space-y-2">
            {["Kavram kullanımı", "Örneklerin doğruluğu", "Anlatım açıklığı"].map((item, index) => (
              <div key={item} className="grid grid-cols-[1fr_5rem] items-center gap-3 text-[10px]">
                <span>{item}</span>
                <span className="h-1 bg-muted"><span className="block h-full bg-primary" style={{ width: `${[94, 82, 88][index]}%` }} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex h-20 w-20 items-center justify-center self-center rounded-full border-[7px] border-primary/20 text-center">
          <span><strong className="block text-xl tabular">8.5</strong><small className="text-[9px] text-muted-foreground">/ 10</small></span>
        </div>
      </div>
    </ProductCard>
  );
}

function StudentPanel() {
  return (
    <ProductCard className="workflow-card--student" label="Öğrenci gelişim önizlemesi">
      <header className="workflow-card-header">
        <span className="workflow-card-icon bg-primary text-primary-foreground">
          <SquareAcademicCap size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Gelişim özeti</strong>
          <small>Son dört değerlendirme</small>
        </span>
        <GraphUp className="ml-auto text-primary" size={21} weight="LineDuotone" />
      </header>
      <div className="grid grid-cols-[0.72fr_1.28fr] gap-5 p-5">
        <div className="border-r border-border pr-4">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Genel gelişim</span>
          <strong className="mt-3 block text-5xl font-semibold tracking-[-0.06em] tabular">%82</strong>
          <span className="mt-3 block text-[10px] text-muted-foreground">Önceki döneme göre +8</span>
        </div>
        <div className="flex items-end gap-2" aria-label="Öğrenci gelişim grafiği">
          {[35, 44, 58, 52, 68, 74, 86].map((height, index) => (
            <span key={index} className="flex-1 bg-primary" style={{ height: `${height}%`, opacity: 0.32 + index * 0.08 }} />
          ))}
        </div>
      </div>
    </ProductCard>
  );
}

function ManagerPanel() {
  return (
    <ProductCard className="workflow-card--manager" label="Kurum analizi önizlemesi">
      <header className="workflow-card-header border-foreground/10">
        <span className="workflow-card-icon bg-primary/10 text-primary">
          <Chart2 size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Kurum görünümü</strong>
          <small>12 sınıf · 284 öğrenci</small>
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">AĞUSTOS</span>
      </header>
      <div className="grid grid-cols-[1fr_auto] gap-5 p-5">
        <div>
          <div className="flex items-end justify-between">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Kazanım ısı haritası</span>
            <strong className="text-sm tabular">%78</strong>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1.5">
            {Array.from({ length: 32 }, (_, index) => (
              <span key={index} className="aspect-square bg-primary" style={{ opacity: 0.18 + ((index * 7) % 10) / 12 }} />
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2 border-l border-foreground/10 pl-4 text-right">
          <strong className="text-3xl tabular">03</strong>
          <span className="max-w-20 text-[10px] leading-tight text-muted-foreground">yakından izlenen kazanım</span>
        </div>
      </div>
    </ProductCard>
  );
}

function RolesPanel() {
  return (
    <ProductCard className="workflow-card--roles" label="Rol dağılımı önizlemesi">
      <header className="workflow-card-header">
        <span className="workflow-card-icon bg-primary/10 text-primary">
          <UsersGroupRounded size={22} weight="LineDuotone" />
        </span>
        <span>
          <strong>Tek sistem, farklı roller</strong>
          <small>Yetkiye göre sadeleşen çalışma alanı</small>
        </span>
      </header>
      <div className="grid grid-cols-2 gap-px bg-border">
        {[
          ["İçerik uzmanı", "Soru üretimi"],
          ["Eğitmen", "Sınav & onay"],
          ["Öğrenci", "Sınav & gelişim"],
          ["Eğitim yöneticisi", "Kurum analizi"],
        ].map(([role, task], index) => (
          <div key={role} className="bg-card p-3.5">
            <span className="flex h-8 w-8 items-center justify-center bg-muted text-primary">
              {index % 2 === 0 ? <UserCheckRounded size={18} weight="LineDuotone" /> : <UsersGroupRounded size={18} weight="LineDuotone" />}
            </span>
            <strong className="mt-3 block text-xs">{role}</strong>
            <small className="mt-1 block text-[10px] text-muted-foreground">{task}</small>
          </div>
        ))}
      </div>
    </ProductCard>
  );
}

const PANELS = [
  SourcePanel,
  QuestionPanel,
  ExamPanel,
  ReviewPanel,
  StudentPanel,
  ManagerPanel,
  RolesPanel,
] as const;

export function LandingWorkflowOrbit() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const progressRef = useRef(INITIAL_PROGRESS);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const frontIndexRef = useRef(1);

  const layoutCards = useCallback((progress: number) => {
    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      const phase = (index / CARD_COUNT + progress + 1) % 1;
      const visible = phase >= 0.08 && phase <= 0.9;
      const t = visible ? (phase - 0.08) / 0.82 : 0;

      if (!visible) {
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        card.dataset.front = "false";
        return;
      }

      const depth = Math.sin(t * Math.PI);
      const edgeFade = Math.min(1, t / 0.08, (1 - t) / 0.1);
      let x: number;
      let y: number;

      if (t < 0.46) {
        const segment = t / 0.46;
        x = 22 - segment * 38;
        y = -355 + segment * 305;
      } else if (t < 0.68) {
        const angle = Math.PI + ((t - 0.46) / 0.22) * (Math.PI / 2);
        x = 98 + 114 * Math.cos(angle);
        y = -50 - 124 * Math.sin(angle);
      } else {
        const segment = (t - 0.68) / 0.32;
        x = 98 + segment * 128;
        y = 74 + segment * 284;
      }

      const scale = 0.47 + depth * 0.57;
      const front = depth > 0.955;
      if (front) frontIndexRef.current = index;

      card.style.zIndex = String(Math.round(10 + depth * 90));
      card.style.opacity = String(edgeFade * (0.32 + depth * 0.68));
      card.style.pointerEvents = front ? "auto" : "none";
      card.style.transform = `translate3d(calc(-50% + ${x}%), calc(-50% + ${y}%), ${-920 + depth * 1220}px) rotateX(${5 - depth * 3}deg) rotateY(${-5 + t * 9}deg) scale(${scale})`;
      card.dataset.front = String(front);
    });
  }, []);

  useEffect(() => {
    layoutCards(progressRef.current);

    let frame = 0;
    let previous = performance.now();
    const animate = (now: number) => {
      const delta = Math.min(now - previous, 48);
      previous = now;
      if (!draggingRef.current) {
        progressRef.current = (progressRef.current + delta * AUTO_SPEED) % 1;
        layoutCards(progressRef.current);
      }
      frame = window.requestAnimationFrame(animate);
    };

    const resetClock = () => {
      previous = performance.now();
    };

    frame = window.requestAnimationFrame(animate);
    document.addEventListener("visibilitychange", resetClock);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resetClock);
    };
  }, [layoutCards]);

  function resetFrontTilt() {
    const frontCard = cardRefs.current[frontIndexRef.current];
    const inner = frontCard?.querySelector<HTMLElement>(".workflow-orbit-card-inner");
    inner?.style.setProperty("--orbit-hover-x", "0deg");
    inner?.style.setProperty("--orbit-hover-y", "0deg");
    frontCard?.style.setProperty("--orbit-glow-opacity", "0.28");
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    draggingRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.dataset.dragging = "true";
    event.currentTarget.setPointerCapture(event.pointerId);
    resetFrontTilt();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingRef.current) {
      const deltaX = event.clientX - lastPointerRef.current.x;
      const deltaY = event.clientY - lastPointerRef.current.y;
      progressRef.current = (progressRef.current + (deltaY + deltaX * 0.28) * 0.00082 + 1) % 1;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      layoutCards(progressRef.current);
      return;
    }

    const frontCard = cardRefs.current[frontIndexRef.current];
    const inner = frontCard?.querySelector<HTMLElement>(".workflow-orbit-card-inner");
    if (!frontCard || !inner || frontCard.dataset.front !== "true") return;
    const bounds = frontCard.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      resetFrontTilt();
      return;
    }
    inner.style.setProperty("--orbit-hover-x", `${(0.5 - y) * 4}deg`);
    inner.style.setProperty("--orbit-hover-y", `${(x - 0.5) * 5}deg`);
    const angle = Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) * (180 / Math.PI) + 90;
    const edgeProximity = Math.max(Math.abs(x - 0.5) * 2, Math.abs(y - 0.5) * 2);
    frontCard.style.setProperty("--orbit-glow-angle", `${angle}deg`);
    frontCard.style.setProperty("--orbit-glow-opacity", String(0.22 + edgeProximity * 0.7));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    progressRef.current = (progressRef.current + direction / CARD_COUNT + 1) % 1;
    layoutCards(progressRef.current);
  }

  return (
    <div className="workflow-showcase" data-landing-reveal data-landing-reveal-delay="2">
      <div className="workflow-mobile-viewport" aria-hidden="true">
        <div className="workflow-mobile-flow">
          {[...PANELS, ...PANELS].map((Panel, index) => (
            <div key={index} className="workflow-mobile-card"><Panel /></div>
          ))}
        </div>
      </div>

      <div
        ref={stageRef}
        aria-label="Aşağı doğru akan sistem ekranları. Kartların akışını değiştirmek için fareyle yukarı veya aşağı sürükleyin."
        className="workflow-orbit-stage"
        onKeyDown={handleKeyDown}
        onPointerCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerLeave={resetFrontTilt}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        role="region"
        tabIndex={0}
      >
        <div className="workflow-orbit-plane">
          {PANELS.map((Panel, index) => (
            <div key={index} ref={(node) => { cardRefs.current[index] = node; }} className="workflow-orbit-item">
              <Panel />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
