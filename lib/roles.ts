/**
 * Rol meta verisi ve yonlendirme haritasi.
 * Rol -> dashboard yolu eslesmesinin TEK kaynagi burasidir;
 * middleware, login ekrani ve navigasyon hep buradan okur.
 */

// Goreli yol bilerek: bu modul `tests/roles.test.ts` tarafindan dogrudan
// calistiriliyor ve test kosucusu (node --experimental-strip-types) `@/`
// takma adini cozemez. Tipler silinip gittigi icin `@/` type-only importlarda
// sorun cikarmaz, ama `isUserRole` bir DEGER; calisma zamaninda cozulmeli.
import { isUserRole, type UserProfile, type UserRole } from "./types.ts";

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
  veli: {
    role: "veli",
    label: "Veli",
    description: "Kendisine tanımlanan öğrencilerin sınav ve kazanım gelişimini izler.",
    path: "/dashboard/veli",
    book: 5,
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
 *
 * TANINMAYAN ROLLER ELENIR. `users.roles` bir Postgres enum dizisidir ve enum
 * veritabani tarafinda arayuzden once buyuyebilir; oyle bir deger (or. enum'a
 * elle eklenen 'veli') suzulmeden gecerse ROLE_DEFINITIONS[rol] `undefined`
 * doner ve rolu ekrana basan her yer - rol degistirici, kullanici yonetim
 * tablosu, rol rozeti - calisma zamaninda cokup tum paneli birlikte goturur.
 */
export function grantedRoles(user: RoleBearer): [UserRole, ...UserRole[]] {
  // Donus tipi BOS OLMAYAN dizi: `defaultRole` ve cagiranlar `[0]` okurken
  // `undefined` kontrolu yapmak zorunda kalmasin. Bos kume zaten aktif role
  // duşurulduğu icin bu her zaman dogru.
  //
  // Suzgec middleware.ts ile ayni: orada `(profile?.roles ?? []).filter(
  // isUserRole)` zaten uygulaniyordu, yetkinin TEK KAYNAGI olmasi gereken bu
  // fonksiyon ise ham diziyi geciriyordu. Iki taraf artik ayni kurali isletir.
  const [first, ...rest] = (user.roles ?? []).filter(isUserRole);
  if (first) return [first, ...rest];

  // Kume bos kaldiysa aktif role duselim; o da taninmiyorsa en dar yetkili
  // role - yine middleware.ts ile ayni varsayilan.
  return [isUserRole(user.role) ? user.role : "ogrenci"];
}

/**
 * Sistem yoneticisi kendi panelinde SABITTIR.
 *
 * `admin` gizli bir roldur ve hesaba genellikle baska roller de atanmis olur
 * (bkz. ROLE_DEFINITIONS - admin, SELECTABLE_ROLES disindadir). Bu durumda ust
 * cubukta rol degistirici cikiyor ve sistem yoneticisi kendini bir bakiyor
 * Egitmen panelinde buluyordu; hangi hesapla nerede oldugu bulaniklasiyordu.
 *
 * Kural: admin rolu verilmis bir hesabin varsayilan paneli HER ZAMAN Sistem
 * Yoneticisi'dir ve rol degistirici o hesapta gosterilmez.
 *
 * Bu bir YETKI kurali DEGILDIR - yalnizca hangi panelin varsayilan oldugunu
 * soyler. Erisim yine yalnizca verilmis rollerden gelir; admin icin gizli bir
 * "her seye erisim" kapisi burada da acilmaz.
 */
export function isAdminPinned(roles: readonly UserRole[]): boolean {
  return roles.includes("admin");
}

/**
 * Hesabin ACILIS paneli: admin verilmisse Sistem Yoneticisi, degilse verilen rol.
 *
 * `/dashboard` kok yolu, oturum acilisi ve yetkisiz bir panele gidilmesi -
 * ucu de buradan gecer ki uc yerde uc ayri sonuc cikmasin.
 */
export function landingRole(
  roles: readonly UserRole[],
  fallback: UserRole,
): UserRole {
  return isAdminPinned(roles) ? "admin" : fallback;
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
