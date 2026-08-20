"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Library,
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
export const ROLE_NAV: Record<UserRole, readonly NavItem[]> = {
  icerik_uzmani: [
    {
      href: "/dashboard/icerik-uzmani",
      label: "Icerik & Kazanimlar",
      icon: BookOpen,
      description: "Metin yukle, AI ile soru uret",
    },
  ],
  egitmen: [
    {
      href: "/dashboard/egitmen",
      label: "Genel Bakis",
      icon: LayoutDashboard,
      description: "Onay bekleyen isler",
    },
    {
      href: "/dashboard/egitmen/soru-havuzu",
      label: "Soru Havuzu",
      icon: Library,
      description: "Taslaklari incele ve onayla",
    },
    {
      href: "/dashboard/egitmen/sinavlar",
      label: "Sinavlar",
      icon: ClipboardList,
      description: "Sinav olustur ve yayina al",
    },
  ],
  ogrenci: [
    {
      href: "/dashboard/ogrenci",
      label: "Sinavlarim",
      icon: GraduationCap,
      description: "Sorulari yanitla",
    },
  ],
  egitim_yoneticisi: [
    {
      href: "/dashboard/yonetici",
      label: "Istatistikler",
      icon: BarChart3,
      description: "Basari ve katilim raporlari",
    },
  ],
};

export interface NavLinksProps {
  role: UserRole;
  /** Mobil cekmecede baglantiya tiklandiginda paneli kapatmak icin. */
  onNavigate?: () => void;
}

export function NavLinks({ role, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = ROLE_NAV[role];

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
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
