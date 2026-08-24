/**
 * Oturumla birlikte temizlenmesi gereken yardimci cerezler.
 *
 * Bunlar YETKI KAYNAGI DEGILDIR; yalnizca yonlendirme kararlarini hizlandirir.
 * Veri erisimini her zaman veritabanindaki RLS politikalari belirler.
 */

/** Rolun kisa sureli onbellegi: "<userId>:<rol>" (bkz. middleware.ts). */
export const ROLE_CACHE_COOKIE = "cached_role";

/**
 * Supabase oturum cerezlerinin tarayici kapaninca silinip silinmeyecegini
 * belirtir. Degerin kendisi kimlik veya yetki tasimaz; yalnizca cerez omrunu
 * belirlemek icin sunucuda okunur.
 */
export const AUTH_PERSISTENCE_COOKIE = "auth_persistence";

export type AuthPersistence = "persistent" | "session";

/** Bilinmeyen/eski oturumlarda Supabase'in tavsiye ettigi kalici davranisi korur. */
export function authPersistenceFromCookie(value: string | undefined): AuthPersistence {
  return value === "session" ? "session" : "persistent";
}

/**
 * "Beni hatirla" kapaliysa Supabase cerezlerini oturum cerezi yapar.
 * Silme cerezlerinde maxAge=0 korunmalidir; aksi halde cikis eski oturumu
 * tarayicidan temizleyemez.
 */
export function authCookieOptions<T extends { maxAge?: number; expires?: Date }>(
  options: T,
  value: string,
  persistence: AuthPersistence,
): T {
  if (persistence === "persistent" || value.length === 0 || options.maxAge === 0) {
    return options;
  }

  const sessionOptions = { ...options };
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}

/** Acik yonlendirmeyi engelleyerek yalnizca uygulama ici bir yolu kabul eder. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** Cikista silinecek cerezler. */
export const SESSION_SCOPED_COOKIES: readonly string[] = [
  ROLE_CACHE_COOKIE,
  AUTH_PERSISTENCE_COOKIE,
  "dev_role",
];
