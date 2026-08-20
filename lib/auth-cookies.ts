/**
 * Oturumla birlikte temizlenmesi gereken yardimci cerezler.
 *
 * Bunlar YETKI KAYNAGI DEGILDIR; yalnizca yonlendirme kararlarini hizlandirir.
 * Veri erisimini her zaman veritabanindaki RLS politikalari belirler.
 */

/** Rolun kisa sureli onbellegi: "<userId>:<rol>" (bkz. middleware.ts). */
export const ROLE_CACHE_COOKIE = "cached_role";

/** Cikista silinecek cerezler. */
export const SESSION_SCOPED_COOKIES: readonly string[] = [
  ROLE_CACHE_COOKIE,
  "dev_role",
];
