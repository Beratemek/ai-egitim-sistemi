"use server";

import { cookies } from "next/headers";

import {
  AUTH_PERSISTENCE_COOKIE,
  SESSION_SCOPED_COOKIES,
  type AuthPersistence,
} from "@/lib/auth-cookies";
import { publicEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type AuthActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: string };

export type SignInInput = {
  email: string;
  password: string;
  remember: boolean;
};

const PERSISTENT_AUTH_MAX_AGE = 400 * 24 * 60 * 60;

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
 * Parola ile girisi sunucuda yapar. Boylece "Beni hatirla" kapaliyken auth
 * cerezleri gercek birer oturum cerezi olarak (Expires/Max-Age olmadan) yazilir.
 */
export async function signInWithPassword(
  input: SignInInput,
): Promise<AuthActionResult> {
  const email = input.email.trim();

  if (!email || !input.password) {
    return { ok: false, error: "E-posta adresi ve parola zorunludur." };
  }

  const persistence: AuthPersistence = input.remember ? "persistent" : "session";
  const supabase = await createServerSupabaseClient({ persistence });
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
  cookieStore.set(AUTH_PERSISTENCE_COOKIE, persistence, {
    // Yetki veya kimlik tasimaz. Tarayici Supabase istemcisi token'i
    // yenilerken ayni kalicilik kuralini uygulayabilsin diye okunabilir.
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(input.remember ? { maxAge: PERSISTENT_AUTH_MAX_AGE } : {}),
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
