/**
 * Rol meta verisi ve yonlendirme haritasi.
 * Rol -> dashboard yolu eslesmesinin TEK kaynagi burasidir;
 * middleware, login ekrani ve navigasyon hep buradan okur.
 */

import type { UserRole } from "@/lib/types";

export interface RoleDefinition {
  role: UserRole;
  /** Arayuzde gosterilen ad. */
  label: string;
  /** Rolun ne yaptigini anlatan tek cumle. */
  description: string;
  /** Bu rolun ana panel yolu. */
  path: `/dashboard/${string}`;
  /** Rozet renkleri (Tailwind sinifi). */
  badgeClass: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  icerik_uzmani: {
    role: "icerik_uzmani",
    label: "Icerik Uzmani",
    description: "Kaynak metin yukler, AI ile soru uretir, havuza onaylar.",
    path: "/dashboard/icerik-uzmani",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  egitmen: {
    role: "egitmen",
    label: "Egitmen",
    description: "Havuzdan sinav olusturur ve ogrenci puanlarini onaylar.",
    path: "/dashboard/egitmen",
    badgeClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
  ogrenci: {
    role: "ogrenci",
    label: "Ogrenci",
    description: "Sinava girer, acik uclu sorulari yanitlar, geri bildirim alir.",
    path: "/dashboard/ogrenci",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  egitim_yoneticisi: {
    role: "egitim_yoneticisi",
    label: "Egitim Yoneticisi",
    description: "Sinav ve basari istatistiklerini raporlar.",
    path: "/dashboard/yonetici",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
};

export const ROLE_LIST: readonly RoleDefinition[] = Object.values(ROLE_DEFINITIONS);

/** Rolun ana panel yolunu dondurur. */
export function dashboardPathFor(role: UserRole): string {
  return ROLE_DEFINITIONS[role].path;
}

/** Rolun okunabilir adini dondurur. */
export function roleLabel(role: UserRole): string {
  return ROLE_DEFINITIONS[role].label;
}

/**
 * `/dashboard/...` altindaki bir yolun hangi role ait oldugunu bulur.
 * Eslesme yoksa `null` doner (ornegin `/dashboard` kok sayfasi).
 */
export function roleForPath(pathname: string): UserRole | null {
  const match = ROLE_LIST.find(
    (definition) =>
      pathname === definition.path || pathname.startsWith(`${definition.path}/`),
  );
  return match?.role ?? null;
}
