"use server";

import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AuthActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

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
