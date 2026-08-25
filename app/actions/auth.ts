"use server";

import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AuthActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * E-posta/parola ile oturum acmayi sunucu tarafinda gerceklestirir.
 *
 * Tarayicinin Supabase alan adina dogrudan istek atmasi; VPN, reklam
 * engelleyici, DNS filtresi veya branch degisiminden sonra bellekte kalan eski
 * istemci nedeniyle `fetch failed` hatasina yol acabiliyordu. Server Action
 * ayni isi uygulama sunucusundan yapar ve Supabase'in oturum cerezlerini bu
 * yanitin icinde guvenli sekilde yazar.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");

  if (!normalizedEmail || !password) {
    return { ok: false, error: "E-posta ve parola alanlarını doldurun." };
  }

  const supabase = await createServerSupabaseClient({ resilientAuthFetch: true });

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      if (/fetch failed/i.test(error.message)) {
        console.error("[auth] Supabase parola istegi ag hatasi", {
          name: error.name,
          status: error.status,
          code: error.code,
        });
      }

      const message = /invalid login credentials/i.test(error.message)
        ? "E-posta veya parola Supabase hesabıyla eşleşmiyor."
        : /fetch failed/i.test(error.message)
          ? "Kimlik doğrulama sunucusuna ulaşılamadı. Lütfen tekrar deneyin."
          : error.message;

      return { ok: false, error: message };
    }

    return { ok: true, message: "Giriş başarılı." };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "fetch failed";

    return {
      ok: false,
      error: /fetch failed/i.test(message)
        ? "Kimlik doğrulama sunucusuna ulaşılamadı. Lütfen tekrar deneyin."
        : message,
    };
  }
}

/**
 * Dogrulama e-postasini yeniden gonderir.
 *
 * Supabase'in yerlesik e-posta servisi saatte 2 mail ile sinirlidir; ust uste
 * denemede saglayici hata dondurur ve mesaji oldugu gibi kullaniciya gosterilir.
 */
export async function resendConfirmationEmail(
  email: string,
): Promise<AuthActionResult> {
  const trimmed = email.trim();

  if (!trimmed) {
    return { ok: false, error: "E-posta adresi bos olamaz." };
  }

  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: trimmed,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message:
      "Dogrulama e-postasi yeniden gonderildi. Gelen kutunuzu ve spam klasorunu kontrol edin.",
  };
}

/** Oturumu kapatir (dogrulama bekleyen kullanici baska hesapla girmek isterse). */
export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}
