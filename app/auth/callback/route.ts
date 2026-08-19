import { NextResponse } from "next/server";

import { dashboardPathFor } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isUserRole } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /auth/callback?code=...
 *
 * Supabase e-posta dogrulama / magic link baglantilarinin dondugu adres.
 * Kod oturuma cevrilir, ardindan kullanici kendi paneline yonlendirilir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=kod_bulunamadi`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=oturum_acilamadi`);
  }

  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = isUserRole(profile?.role) ? profile.role : "ogrenci";

  return NextResponse.redirect(`${origin}${dashboardPathFor(role)}`);
}
