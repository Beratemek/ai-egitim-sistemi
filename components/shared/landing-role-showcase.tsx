"use client";

import Chart2 from "@solar-icons/react/ssr/business/Chart2";
import ClipboardCheck from "@solar-icons/react/ssr/notes/ClipboardCheck";
import DocumentText from "@solar-icons/react/ssr/notes/DocumentText";
import SquareAcademicCap from "@solar-icons/react/ssr/school/SquareAcademicCap";
import UserHeart from "@solar-icons/react/ssr/users/UserHeart";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { buttonVariants } from "@/components/ui/button";
import { SELECTABLE_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type PublicRole = Exclude<UserRole, "admin">;

type RolePreview = {
  bars: readonly number[];
  description: string;
  eyebrow: string;
  headline: string;
  metrics: readonly { label: string; value: string }[];
  status: string;
};

const ROLE_PREVIEWS: Record<PublicRole, RolePreview> = {
  icerik_uzmani: {
    description: "Kaynak metni düzenler, soru taslaklarını oluşturur ve havuza onaylar.",
    eyebrow: "Soru üretim masası",
    headline: "Kaynakla eşleşen soruları, rubrikleriyle birlikte hazırlayın.",
    metrics: [
      { label: "Yeni taslak", value: "12" },
      { label: "Onaylanan", value: "08" },
      { label: "Kaynak", value: "04" },
    ],
    bars: [62, 84, 71, 92, 76, 88, 80],
    status: "8 soru havuza hazır",
  },
  egitmen: {
    description: "Havuzdan sınav oluşturur, öğrenci yanıtlarını inceler ve puanları kesinleştirir.",
    eyebrow: "Sınav ve değerlendirme",
    headline: "Sınavı kurun, açık uçlu yanıtları son karara bağlayın.",
    metrics: [
      { label: "Aktif sınav", value: "03" },
      { label: "Onay bekleyen", value: "18" },
      { label: "Tamamlanan", value: "%74" },
    ],
    bars: [46, 58, 78, 66, 89, 72, 95],
    status: "18 değerlendirme incelenecek",
  },
  ogrenci: {
    description: "Sınava girer, yanıtlarını tamamlar ve kendisine ait geri bildirimleri takip eder.",
    eyebrow: "Öğrenme alanım",
    headline: "Sıradaki sınavı, geri bildirimi ve gelişim yönünü görün.",
    metrics: [
      { label: "Gelişim", value: "%82" },
      { label: "Tamamlanan", value: "07" },
      { label: "Sıradaki", value: "14:30" },
    ],
    bars: [42, 55, 61, 68, 73, 79, 86],
    status: "Fen Bilimleri sınavı bugün",
  },
  veli: {
    description: "Kendisine tanımlanan öğrencilerin sınav katılımını ve kazanım gelişimini güvenli özetlerle izler.",
    eyebrow: "Öğrenci gelişim takibi",
    headline: "Çocuğunuzun ilerlemesini, desteğe ihtiyaç duyduğu alanlarla birlikte görün.",
    metrics: [
      { label: "Tamamlanan", value: "07" },
      { label: "Ortalama", value: "%82" },
      { label: "Destek alanı", value: "02" },
    ],
    bars: [48, 56, 61, 70, 74, 80, 84],
    status: "Son gelişim özeti hazır",
  },
  egitim_yoneticisi: {
    description: "Sınıf, sınav ve kazanım verilerini karşılaştırarak eğitim sürecini izler.",
    eyebrow: "Kurum görünümü",
    headline: "Sınıfları karşılaştırın, desteğe ihtiyaç duyulan alanı bulun.",
    metrics: [
      { label: "Sınıf", value: "12" },
      { label: "Öğrenci", value: "284" },
      { label: "Katılım", value: "%91" },
    ],
    bars: [72, 88, 64, 91, 78, 69, 85],
    status: "3 kazanım yakından izleniyor",
  },
};

const ROLE_ICONS = {
  icerik_uzmani: DocumentText,
  egitmen: ClipboardCheck,
  ogrenci: SquareAcademicCap,
  veli: UserHeart,
  egitim_yoneticisi: Chart2,
} as const;

const FIRST_ROLE = SELECTABLE_ROLES[0]!.role as PublicRole;

export function LandingRoleShowcase() {
  const [activeRole, setActiveRole] = useState<PublicRole>(FIRST_ROLE);
  const hoverTimerRef = useRef<number | null>(null);
  const activeIndex = SELECTABLE_ROLES.findIndex((item) => item.role === activeRole);

  useEffect(() => () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
  }, []);

  function clearPendingHover() {
    if (!hoverTimerRef.current) return;
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }

  function scheduleRole(role: PublicRole) {
    clearPendingHover();
    hoverTimerRef.current = window.setTimeout(() => {
      setActiveRole(role);
      hoverTimerRef.current = null;
    }, 90);
  }

  function activateRole(role: PublicRole) {
    clearPendingHover();
    setActiveRole(role);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % SELECTABLE_ROLES.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + SELECTABLE_ROLES.length) % SELECTABLE_ROLES.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = SELECTABLE_ROLES.length - 1;

    const nextRole = SELECTABLE_ROLES[nextIndex]!.role as PublicRole;
    activateRole(nextRole);
    document.getElementById(`role-accordion-trigger-${nextRole}`)?.focus();
  }

  return (
    <div className="role-accordion" role="list" aria-label="Sistemdeki çalışma alanları">
      {SELECTABLE_ROLES.map((definition, index) => {
        const role = definition.role as PublicRole;
        const preview = ROLE_PREVIEWS[role];
        const Icon = ROLE_ICONS[role];
        const active = role === activeRole;

        return (
          <article
            key={role}
            className="role-accordion-panel"
            data-active={active}
            onMouseEnter={() => scheduleRole(role)}
            onMouseLeave={clearPendingHover}
            role="listitem"
            style={{ "--role-accent": `hsl(var(--book-${definition.book}))` } as CSSProperties}
          >
            <button
              id={`role-accordion-trigger-${role}`}
              aria-controls={`role-accordion-content-${role}`}
              aria-expanded={active}
              className="role-accordion-trigger"
              onClick={() => activateRole(role)}
              onFocus={() => activateRole(role)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              type="button"
            >
              <span className="role-accordion-icon"><Icon aria-hidden weight="LineDuotone" /></span>
              <span className="role-accordion-vertical-label">{definition.label}</span>
              <span className="role-accordion-index">0{index + 1}</span>
            </button>

            <div
              id={`role-accordion-content-${role}`}
              aria-hidden={!active}
              className="role-accordion-content"
            >
              <div className="role-accordion-copy">
                <p>{preview.eyebrow}</p>
                <h3>{preview.headline}</h3>
                <span>{preview.description}</span>
              </div>

              <div className="role-accordion-dashboard">
                <div className="role-accordion-metrics">
                  {preview.metrics.map((metric) => (
                    <div key={metric.label}>
                      <small>{metric.label}</small>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="role-accordion-chart">
                  <div>
                    <strong>Son 7 ölçüm</strong>
                    <small>Kazanım başarı eğilimi</small>
                  </div>
                  <div className="role-chart-bars" aria-label="Son yedi ölçüm grafiği">
                    {preview.bars.map((height, barIndex) => (
                      <span key={barIndex} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="role-accordion-footer">
                <span><CheckCircle2 aria-hidden />{preview.status}</span>
                <Link
                  className={cn(buttonVariants({ size: "lg" }), "specular-cta rounded-xl px-5")}
                  href={`/auth/signout-and-login?mode=kayit&role=${role}`}
                  tabIndex={active ? 0 : -1}
                >
                  Bu rolle başlayın
                  <ArrowRight />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
      <span className="sr-only" aria-live="polite">{SELECTABLE_ROLES[activeIndex]?.label} çalışma alanı gösteriliyor.</span>
    </div>
  );
}
