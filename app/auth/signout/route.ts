import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

/** POST /auth/signout - oturumu kapatir ve giris ekranina doner. */
export async function POST(request: Request) {
  if (isSupabaseConfigured) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
