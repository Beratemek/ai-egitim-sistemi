/**
 * Yerel gelistirme kolayliklari.
 *
 * IKI kosul birden saglanmadan hicbiri devreye girmez:
 *   1. NODE_ENV !== "production"            (uretim derlemesinde asla)
 *   2. NEXT_PUBLIC_DEV_ROLE_SWITCH === "true"  (acikca acilmis olmali)
 *
 * Boylece `next build` ile alinan bir surumde rol degistirici ve hizli giris
 * kod icinde bulunsa bile calisamaz.
 */

/** Rol degistirici cerezinin adi. */
export const DEV_ROLE_COOKIE = "dev_role";

const isProduction = process.env.NODE_ENV === "production";
const switchRequested = process.env.NEXT_PUBLIC_DEV_ROLE_SWITCH === "true";

/** Rol degistirici ve hizli giris kullanilabilir mi? */
export const isDevRoleSwitchEnabled: boolean = !isProduction && switchRequested;

/**
 * Yalnizca sunucuda okunur. Parolayi NEXT_PUBLIC_ yapmiyoruz ki istemci
 * paketine girmesin; hizli giris bir Server Action icinde calisir.
 */
export const devCredentials = {
  email: process.env.DEV_ADMIN_EMAIL ?? "",
  password: process.env.DEV_ADMIN_PASSWORD ?? "",
} as const;

/** Hizli giris butonu gosterilebilir mi? (sunucu tarafi kontrolu) */
export function canQuickLogin(): boolean {
  return (
    isDevRoleSwitchEnabled &&
    devCredentials.email.length > 0 &&
    devCredentials.password.length > 0
  );
}
