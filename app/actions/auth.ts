"use server";

import { cookies } from "next/headers";

import { SESSION_SCOPED_COOKIES } from "@/lib/auth-cookies";
import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  SESSION_ACTIVITY_COOKIE,
  SESSION_ACTIVITY_COOKIE_MAX_AGE,
} from "@/lib/session-activity";

export type AuthActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

export type SignInInput = {
  email: string;
  password: string;
};

function signInErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "E-posta adresi veya parola hatalı.";
  }
  if (/email not confirmed/i.test(message)) {
    return "E-posta adresiniz henüz doğrulanmamış.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Çok fazla deneme yapıldı. Lütfen kısa bir süre sonra tekrar deneyin.";
  }
  return "Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.";
}

/**
 * Parola ile girisi sunucuda yapar ve ilk etkinlik zamanini yerel cereze yazar.
 */
export async function signInWithPassword(
  input: SignInInput,
): Promise<AuthActionResult> {
  const email = input.email.trim();

  if (!email || !input.password) {
    return { ok: false, error: "E-posta adresi ve parola zorunludur." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      error: signInErrorMessage(error.message),
      code: error.code,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), {
    // Yetki kaynagi degildir; middleware'in bosta kalma suresini ilk istekte
    // de denetleyebilmesi icin tarayici tarafindan yenilenebilir.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_ACTIVITY_COOKIE_MAX_AGE,
  });

  return { ok: true, message: "Giriş başarılı." };
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

  const cookieStore = await cookies();
  for (const name of SESSION_SCOPED_COOKIES) cookieStore.delete(name);
}
