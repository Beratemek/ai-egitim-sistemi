import { NextResponse } from "next/server";

import { SESSION_SCOPED_COOKIES, safeNextPath } from "@/lib/auth-cookies";
import { isSupabaseConfigured } from "@/lib/env";
import { SELECTABLE_ROLES } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

/**
 * GET /auth/signout-and-login
 *
 * Dogrulama bekleyen kullanicinin baska bir hesapla devam edebilmesi icin
 * oturumu kapatip giris ekranina dondurur. (POST /auth/signout form gerektirir;
 * bu uc, metin baglantisindan cagrilabilsin diye GET.)
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  const loginUrl = new URL("/login", request.url);
  const mode = requestUrl.searchParams.get("mode");
  const role = requestUrl.searchParams.get("role");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const message = requestUrl.searchParams.get("message");

  if (mode === "giris" || mode === "kayit") loginUrl.searchParams.set("mode", mode);
  if (role && SELECTABLE_ROLES.some((item) => item.role === role)) {
    loginUrl.searchParams.set("role", role);
  }
  if (next) loginUrl.searchParams.set("next", next);
  if (message) loginUrl.searchParams.set("message", message.slice(0, 240));

  const response = NextResponse.redirect(loginUrl);

  // Rol onbellegi ve rol taklidi cerezleri oturuma baglidir.
  for (const name of SESSION_SCOPED_COOKIES) response.cookies.delete(name);

  return response;
}
