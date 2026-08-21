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
    label: "İçerik Uzmanı",
    description: "Kaynak metin yükler, AI ile soru üretir, havuza onaylar.",
    path: "/dashboard/icerik-uzmani",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  egitmen: {
    role: "egitmen",
    label: "Eğitmen",
    description: "Havuzdan sınav oluşturur ve öğrenci puanlarını onaylar.",
    path: "/dashboard/egitmen",
    badgeClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
  ogrenci: {
    role: "ogrenci",
    label: "Öğrenci",
    description: "Sınava girer, açık uçlu soruları yanıtlar, geri bildirim alır.",
    path: "/dashboard/ogrenci",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  egitim_yoneticisi: {
    role: "egitim_yoneticisi",
    label: "Eğitim Yöneticisi",
    description: "Sınav ve başarı istatistiklerini raporlar.",
    path: "/dashboard/yonetici",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  admin: {
    role: "admin",
    label: "Sistem Yöneticisi",
    description: "Rolleri, kullanıcıları ve sınıfları yönetir.",
    path: "/dashboard/sistem",
    badgeClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
};

/**
 * Kullanicinin KENDI secebilecegi roller.
 *
 * `admin` bilerek disaridadir: gizli bir roldur, kayit ve rol secim
 * ekranlarinda gorunmez, yalnizca veritabanindan atanir. Rol listeleyen her
 * arayuz ROLE_LIST degil bunu kullanmalidir.
 */
export const SELECTABLE_ROLES: readonly RoleDefinition[] = Object.values(
  ROLE_DEFINITIONS,
).filter((definition) => definition.role !== "admin");

/** Tum roller (gizli olanlar dahil). Yalnizca ic kullanim icin. */
export const ROLE_LIST: readonly RoleDefinition[] = Object.values(ROLE_DEFINITIONS);

/**
 * Gizli sistem yoneticisi rolu mu?
 *
 * DIKKAT: bu "her seye yetkili" demek DEGILDIR. Sistem yoneticisi de yalnizca
 * kendisine ATANMIS rollerin panellerine girer; her panele girmesi
 * isteniyorsa cozum ona o rolleri atamaktir. Veritabanindaki `is_admin()`
 * yalnizca rol/sinif/ders yonetimi islemlerini yetkilendirir.
 */
export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

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
