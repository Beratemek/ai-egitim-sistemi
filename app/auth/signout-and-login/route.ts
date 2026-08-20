import { NextResponse } from "next/server";

import { SESSION_SCOPED_COOKIES } from "@/lib/auth-cookies";
import { isSupabaseConfigured } from "@/lib/env";
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
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url));

  // Rol onbellegi ve rol taklidi cerezleri oturuma baglidir.
  for (const name of SESSION_SCOPED_COOKIES) response.cookies.delete(name);

  return response;
}
