/**
 * Oturumla birlikte temizlenmesi gereken yardimci cerezler.
 *
 * Bunlar YETKI KAYNAGI DEGILDIR; yalnizca yonlendirme kararlarini hizlandirir.
 * Veri erisimini her zaman veritabanindaki RLS politikalari belirler.
 */

/** Rolun kisa sureli onbellegi: "<userId>:<rol>" (bkz. middleware.ts). */
export const ROLE_CACHE_COOKIE = "cached_role";
export const SESSION_ACTIVITY_COOKIE = "session_last_activity";

/** Acik yonlendirmeyi engelleyerek yalnizca uygulama ici bir yolu kabul eder. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** Cikista silinecek cerezler. */
export const SESSION_SCOPED_COOKIES: readonly string[] = [
  ROLE_CACHE_COOKIE,
  SESSION_ACTIVITY_COOKIE,
  "dev_role",
];
