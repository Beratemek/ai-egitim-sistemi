import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeNextPath } from "@/lib/auth-cookies";
import { dashboardPathFor } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isUserRole } from "@/lib/types";

export const runtime = "nodejs";

/** Supabase'in e-posta baglantilarinda kullandigi dogrulama tipleri. */
const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * GET /auth/callback
 *
 * Supabase e-posta dogrulama / magic link / OAuth donuslerini karsilar.
 * Iki akisi birden destekler:
 *
 *   1. `?token_hash=...&type=signup`  -> verifyOtp
 *      Sunucu tarafinda dogrulanir, PKCE dogrulayici cerezine ihtiyac duymaz.
 *      Kullanici maili BASKA bir cihazda/tarayicida acsa bile calisir.
 *
 *   2. `?code=...`                    -> exchangeCodeForSession
 *      PKCE akisi. Yalnizca kaydin baslatildigi tarayicida calisir, cunku
 *      code verifier o tarayicinin cerezinde durur. OAuth donusu de buradan gecer.
 *
 * Hata durumunda kullanici sessizce giris sayfasina atilmaz; sebep
 * `?error=` ile tasinir ve giris ekraninda gosterilir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const next = safeNextPath(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  // Supabase'in kendisi hata ile geri dondurduyse (suresi dolmus baglanti vb.)
  // mesaji oldugu gibi tasi - "kod bulunamadi" demek yaniltici olurdu.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const errorPath = next === "/sifre-yenile" ? "/sifremi-unuttum" : "/login";

  function redirectWithError(message: string) {
    const target = new URL(errorPath, origin);
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  }

  if (providerError) {
    return redirectWithError(providerError);
  }

  const supabase = await createServerSupabaseClient();

  let userId: string | null = null;

  if (tokenHash && isOtpType(type)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (error || !data.user) {
      return redirectWithError(
        error?.message ??
          "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin.",
      );
    }

    userId = data.user.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return redirectWithError(
        error?.message ??
          "Oturum açılamadı. Bağlantıyı isteği başlattığınız tarayıcıda açmayı deneyin.",
      );
    }

    userId = data.user.id;
  } else {
    return redirectWithError(
      "Doğrulama bilgisi bulunamadı. Bağlantının tamamını kopyaladığınızdan emin olun.",
    );
  }

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const role = isUserRole(profile?.role) ? profile.role : "ogrenci";

  return NextResponse.redirect(`${origin}${dashboardPathFor(role)}`);
}
