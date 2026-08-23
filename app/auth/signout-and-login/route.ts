import { NextResponse } from "next/server";

import { SESSION_SCOPED_COOKIES } from "@/lib/auth-cookies";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isUserRole } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /auth/signout-and-login
 *
 * Dogrulama bekleyen kullanicinin baska bir hesapla devam edebilmesi icin
 * oturumu kapatip giris ekranina dondurur. (POST /auth/signout form gerektirir;
 * bu uc, metin baglantisindan cagrilabilsin diye GET.)
 */
export async function GET(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", request.url);
  const mode = requestUrl.searchParams.get("mode");
  const role = requestUrl.searchParams.get("role");
  const next = requestUrl.searchParams.get("next");

  if (mode === "giris" || mode === "kayit") {
    loginUrl.searchParams.set("mode", mode);
  }

  if (isUserRole(role) && role !== "admin") {
    loginUrl.searchParams.set("role", role);
  }

  // Yalnizca uygulama ici mutlak yollar kabul edilir; acik yonlendirme yoktur.
  if (next?.startsWith("/") && !next.startsWith("//")) {
    loginUrl.searchParams.set("next", next);
  }

  const response = NextResponse.redirect(loginUrl);

  // Rol onbellegi ve rol taklidi cerezleri oturuma baglidir.
  for (const name of SESSION_SCOPED_COOKIES) response.cookies.delete(name);

  return response;
}
