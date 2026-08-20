/**
 * Server action'larin ortak sozlesmesi.
 *
 * Bu dosya bilincli olarak "use server" TASIMAZ: yalnizca tip ve saf yardimci
 * barindirir, boylece hem sunucu action'lari hem istemci bilesenleri import edebilir.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Supabase yapilandirilmadiginda (demo modu) kalici islemler icin dondurulen hata.
 * Arayuz bu mesaji oldugu gibi gosterir.
 */
export function demoGuard(): { ok: false; error: string } {
  return {
    ok: false,
    error:
      "Bu islem icin Supabase baglantisi gerekiyor. .env.local dosyasini doldurup sunucuyu yeniden baslatin.",
  };
}
