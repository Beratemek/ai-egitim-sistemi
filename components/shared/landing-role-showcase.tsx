"use client";

import Chart2 from "@solar-icons/react/ssr/business/Chart2";
import ClipboardCheck from "@solar-icons/react/ssr/notes/ClipboardCheck";
import DocumentText from "@solar-icons/react/ssr/notes/DocumentText";
import SquareAcademicCap from "@solar-icons/react/ssr/school/SquareAcademicCap";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { SELECTABLE_ROLES } from "@/lib/roles";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type PublicRole = Exclude<UserRole, "admin">;

type RolePreview = {
  bars: readonly number[];
  eyebrow: string;
  headline: string;
  metrics: readonly { label: string; value: string }[];
  status: string;
};

const ROLE_PREVIEWS: Record<PublicRole, RolePreview> = {
  icerik_uzmani: {
    eyebrow: "Soru üretim masası",
    headline: "Kaynağa bağlı taslakları onaya hazırlayın.",
    metrics: [
      { label: "Yeni taslak", value: "12" },
      { label: "Onaylanan", value: "08" },
      { label: "Kaynak", value: "04" },
    ],
    bars: [62, 84, 71, 92, 76, 88, 80],
    status: "8 soru havuza hazır",
  },
  egitmen: {
    eyebrow: "Sınav ve değerlendirme",
    headline: "Sınavı kurun, açık uçlu cevapları güvenle değerlendirin.",
    metrics: [
      { label: "Aktif sınav", value: "03" },
      { label: "Onay bekleyen", value: "18" },
      { label: "Tamamlanan", value: "%74" },
    ],
    bars: [46, 58, 78, 66, 89, 72, 95],
    status: "18 değerlendirme incelenecek",
  },
  ogrenci: {
    eyebrow: "Öğrenme alanım",
    headline: "Sıradaki sınavı, gelişimi ve geri bildirimi görün.",
    metrics: [
      { label: "Gelişim", value: "%82" },
      { label: "Tamamlanan", value: "07" },
      { label: "Sıradaki", value: "14:30" },
    ],
    bars: [42, 55, 61, 68, 73, 79, 86],
    status: "Fen Bilimleri sınavı bugün",
  },
  egitim_yoneticisi: {
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

const ROLE_SHOWCASE_ICONS = {
  icerik_uzmani: DocumentText,
  egitmen: ClipboardCheck,
  ogrenci: SquareAcademicCap,
  egitim_yoneticisi: Chart2,
} as const;

const FIRST_ROLE = SELECTABLE_ROLES[0]!.role as PublicRole;

export function LandingRoleShowcase() {
  const [activeRole, setActiveRole] = useState<PublicRole>(FIRST_ROLE);
  const definition = SELECTABLE_ROLES.find((item) => item.role === activeRole) ?? SELECTABLE_ROLES[0]!;
  const preview = ROLE_PREVIEWS[activeRole];
  const ActiveIcon = ROLE_SHOWCASE_ICONS[activeRole];

  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:gap-6">
      <div
        aria-label="Rol seçimi"
        className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
        role="tablist"
      >
        {SELECTABLE_ROLES.map((item) => {
          const role = item.role as PublicRole;
          const Icon = ROLE_SHOWCASE_ICONS[role];
          const active = role === activeRole;

          return (
            <button
              key={role}
              aria-controls="role-preview-panel"
              aria-selected={active}
              className={cn(
                "group flex min-w-[13.5rem] items-center gap-4 border-b border-x-0 border-t-0 px-2 py-4 text-left transition-[color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:min-w-0",
                active
                  ? "border-primary text-foreground"
                  : "border-foreground/15 text-muted-foreground hover:border-foreground/35 hover:text-foreground",
              )}
              id={`role-tab-${role}`}
              onClick={() => setActiveRole(role)}
              role="tab"
              type="button"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center"
                style={{ color: `hsl(var(--book-${item.book}))` }}
              >
                <Icon className="h-7 w-7" weight="LineDuotone" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Paneli keşfet
                </span>
              </span>
              <ArrowRight className={cn("ml-auto h-4 w-4 transition-transform", active && "translate-x-0.5")} />
            </button>
          );
        })}
      </div>

      <div
        key={activeRole}
        aria-labelledby={`role-tab-${activeRole}`}
        className="role-preview-enter relative min-h-[32rem] overflow-hidden rounded-xl border border-foreground/15 bg-card p-5 shadow-[0_18px_46px_-34px_hsl(var(--foreground)/0.4)] sm:p-7 lg:p-8"
        id="role-preview-panel"
        role="tabpanel"
      >
        <div className="relative flex items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{preview.eyebrow}</p>
            <h3 className="mt-3 max-w-2xl font-display text-3xl leading-tight sm:text-4xl">{preview.headline}</h3>
          </div>
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center text-primary sm:flex">
            <ActiveIcon className="h-9 w-9" weight="LineDuotone" />
          </span>
        </div>

        <div className="relative mt-7 grid grid-cols-3 gap-px border bg-border">
          {preview.metrics.map((metric) => (
            <div key={metric.label} className="bg-background p-3 sm:p-4">
              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold tabular sm:text-2xl">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-4 border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Son 7 ölçüm</p>
              <p className="mt-1 text-xs text-muted-foreground">Kazanım başarı eğilimi</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">Canlı görünüm</span>
          </div>
          <div className="mt-6 flex h-28 items-end gap-2 sm:gap-3" aria-label="Son yedi ölçüm grafiği">
            {preview.bars.map((height, index) => (
              <span
                key={index}
                className="min-h-2 flex-1 rounded-t-lg bg-primary/20 transition-[height,background-color] duration-500 hover:bg-primary"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {preview.status}
          </span>
          <Link
            className={cn(buttonVariants({ size: "lg" }), "rounded-xl px-6")}
            href={`/auth/signout-and-login?mode=kayit&role=${definition.role}`}
          >
            Bu rolle başlayın
            <ArrowRight />
          </Link>
        </div>
      </div>
    </div>
  );
}
