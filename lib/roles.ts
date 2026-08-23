/**
 * Rol meta verisi ve yonlendirme haritasi.
 * Rol -> dashboard yolu eslesmesinin TEK kaynagi burasidir;
 * middleware, login ekrani ve navigasyon hep buradan okur.
 */

import type { UserProfile, UserRole } from "@/lib/types";

export interface RoleDefinition {
  role: UserRole;
  /** Arayuzde gosterilen ad. */
  label: string;
  /** Rolun ne yaptigini anlatan tek cumle. */
  description: string;
  /** Bu rolun ana panel yolu. */
  path: `/dashboard/${string}`;
  /**
   * Rolun cilt rengi: `--book-1..8` jetonlarindan biri.
   *
   * Once ham Tailwind renkleri (sky/violet/amber...) yaziliydi. O renkler
   * tema jetonlarina bagli olmadigi icin acik/koyu temada panelin geri
   * kalanina yabanci duruyordu - menudeki kitap sirtlari bir palet,
   * rozetler baska bir palet konusuyordu. Artik ikisi de ayni jetonlardan
   * besleniyor; rol nerede gorunurse gorunsun AYNI rengi tasiyor.
   */
  book: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  icerik_uzmani: {
    role: "icerik_uzmani",
    label: "İçerik Uzmanı",
    description: "Kaynak metin yükler, AI ile soru üretir, havuza onaylar.",
    path: "/dashboard/icerik-uzmani",
    book: 3, // petrol yesili
  },
  egitmen: {
    role: "egitmen",
    label: "Eğitmen",
    description: "Havuzdan sınav oluşturur ve öğrenci puanlarını onaylar.",
    path: "/dashboard/egitmen",
    book: 4, // lacivert
  },
  ogrenci: {
    role: "ogrenci",
    label: "Öğrenci",
    description: "Sınava girer, açık uçlu soruları yanıtlar, geri bildirim alır.",
    path: "/dashboard/ogrenci",
    book: 2, // hardal
  },
  egitim_yoneticisi: {
    role: "egitim_yoneticisi",
    label: "Eğitim Yöneticisi",
    description: "Sınav ve başarı istatistiklerini raporlar.",
    path: "/dashboard/yonetici",
    book: 8, // altin sarisi
  },
  admin: {
    role: "admin",
    label: "Sistem Yöneticisi",
    description: "Rolleri, kullanıcıları ve sınıfları yönetir.",
    path: "/dashboard/sistem",
    book: 1, // kiremit
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

/** Rol kumesi ve aktif rol tasiyan her kayit. */
type RoleBearer = Pick<UserProfile, "role" | "roles">;

/**
 * Kullaniciya VERILMIS roller, atama sirasiyla.
 *
 * `roles` kolonu eklenmeden once olusmus kayitlarda kume bos olabilir; o
 * durumda aktif rol tek eleman olarak kabul edilir ki listeler bos gorunmesin.
 */
export function grantedRoles(user: RoleBearer): [UserRole, ...UserRole[]] {
  // Donus tipi BOS OLMAYAN dizi: `defaultRole` ve cagiranlar `[0]` okurken
  // `undefined` kontrolu yapmak zorunda kalmasin. Bos kume zaten aktif role
  // duşurulduğu icin bu her zaman dogru.
  const [first, ...rest] = user.roles ?? [];
  return first ? [first, ...rest] : [user.role];
}

/**
 * VARSAYILAN rol: kisiye atanan ILK rol.
 *
 * Aktif rolden (`user.role`) ayri bir kavramdir. Kullanici rol degistiricisiyle
 * baska bir role gecebilir; varsayilan, sistem yoneticisinin atama sirasinda
 * ilk sirada biraktiği roldur ve kume yeniden atanana kadar degismez.
 *
 * Siranin korunmasi veritabaninda `set_user_roles` fonksiyonuna bagli
 * (bkz. migrations/BEKLEYEN-1-varsayilan-rol.sql). O fonksiyon dizideki
 * sirayi bozarsa buradaki deger de anlamsizlasir.
 */
export function defaultRole(user: RoleBearer): UserRole {
  return grantedRoles(user)[0];
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
