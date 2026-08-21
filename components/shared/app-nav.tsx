"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
  ShieldCheck,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ROLE_ICONS } from "@/components/shared/role-icons";
import { cn } from "@/lib/utils";
import { ROLE_DEFINITIONS } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

/** Rol basina sol menu ogeleri. */
const BASE_NAV = {
  icerik_uzmani: [
    {
      href: "/dashboard/icerik-uzmani",
      label: "İçerik & Kazanımlar",
      icon: BookOpen,
      description: "Metin yükle, AI ile soru üret",
    },
  ],
  egitmen: [
    {
      href: "/dashboard/egitmen",
      label: "Genel Bakış",
      icon: LayoutDashboard,
      description: "Sınavlar ve puan onayları",
    },
    {
      href: "/dashboard/egitmen/soru-havuzu",
      label: "Soru Havuzu",
      icon: Library,
      description: "Dal bazlı havuz, sınava soru ekle",
    },
    {
      href: "/dashboard/egitmen/kontrol",
      label: "Sınav Kontrolü",
      icon: ClipboardCheck,
      description: "Sınıf bazlı bütün değerlendirme",
    },
    {
      href: "/dashboard/egitmen/sinavlar",
      label: "Sınavlar",
      icon: ClipboardList,
      description: "Sınav oluştur, yayına al, PDF indir",
    },
  ],
  ogrenci: [
    {
      href: "/dashboard/ogrenci",
      label: "Sınavlarım",
      icon: GraduationCap,
      description: "Soruları yanıtla",
    },
    {
      href: "/dashboard/ogrenci/sonuclar",
      label: "Sonuçlarım",
      icon: Trophy,
      description: "Onaylanan puan ve geri bildirimler",
    },
    {
      href: "/dashboard/ogrenci/gelisim",
      label: "Gelişimim",
      icon: TrendingUp,
      description: "Kazanım bazlı ilerlemeni izle",
    },
  ],
  egitim_yoneticisi: [
    {
      href: "/dashboard/yonetici",
      label: "İstatistikler",
      icon: BarChart3,
      description: "Başarı ve katılım raporları",
    },
  ],
} satisfies Record<Exclude<UserRole, "admin">, readonly NavItem[]>;

/**
 * Rol basina sol menu.
 *
 * `admin` SISTEMI yonetir: roller, kullanicilar, siniflar ve panel ayarlari.
 * Soru uretmek, sinav olusturmak, cevap onaylamak gibi ROL ISLERI menusunde
 * YOKTUR - onlar ilgili rollerin isidir. Yonetici bu islere karismasi
 * gerekiyorsa kendisine o rolu de atatir (bkz. coklu rol).
 */
export const ROLE_NAV: Record<UserRole, readonly NavItem[]> = {
  ...BASE_NAV,
  admin: [
    {
      href: "/dashboard/sistem",
      label: "Sistem Yönetimi",
      icon: ShieldCheck,
      description: "Roller, kullanıcılar ve sınıflar",
    },
  ],
};

export interface NavLinksProps {
  role: UserRole;
  /** Mobil cekmecede baglantiya tiklandiginda paneli kapatmak için. */
  onNavigate?: () => void;
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = ROLE_NAV[role];

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard/ogrenci" && pathname.startsWith(`${item.href}/`)) ||
          (item.href === "/dashboard/ogrenci" &&
            pathname.startsWith("/dashboard/ogrenci/sinav/"));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className="flex flex-col">
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function RoleCard({ role }: { role: UserRole }) {
  const definition = ROLE_DEFINITIONS[role];
  const Icon = ROLE_ICONS[role];

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">{definition.label}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {definition.description}
      </p>
    </div>
  );
}
