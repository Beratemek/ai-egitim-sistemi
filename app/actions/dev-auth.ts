"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  DEV_ROLE_COOKIE,
  canQuickLogin,
  devCredentials,
  isDevRoleSwitchEnabled,
} from "@/lib/dev-mode";
import { dashboardPathFor } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isUserRole, type UserRole } from "@/lib/types";

/**
 * Gelistirici hizli girisi.
 *
 * .env.local icindeki DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD ile oturum acar.
 * Parola sunucuda kalir, istemci paketine girmez.
 */
export async function devQuickLogin(): Promise<{ error: string } | never> {
  if (!canQuickLogin()) {
    return { error: "Gelistirici girisi kapali veya kimlik bilgileri eksik." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: devCredentials.email,
    password: devCredentials.password,
  });

  if (error || !data.user) {
    return {
      error:
        error?.message ??
        "Giris yapilamadi. DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD dogru mu?",
    };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role: UserRole = isUserRole(profile?.role) ? profile.role : "ogrenci";

  revalidatePath("/", "layout");
  redirect(dashboardPathFor(role));
}

/**
 * Rolu degistirir: gercek hesabi degistirmeden arayuzu baska bir rol gibi
 * gosterir. Yalnizca gelistirme modunda calisir.
 */
export async function switchDevRole(role: UserRole): Promise<void> {
  if (!isDevRoleSwitchEnabled) return;
  if (!isUserRole(role)) return;

  const cookieStore = await cookies();
  cookieStore.set(DEV_ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath("/", "layout");
  redirect(dashboardPathFor(role));
}

/** Rol taklidini kaldirir; kullanici kendi gercek roluyle devam eder. */
export async function clearDevRole(): Promise<void> {
  if (!isDevRoleSwitchEnabled) return;

  const cookieStore = await cookies();
  cookieStore.delete(DEV_ROLE_COOKIE);

  revalidatePath("/", "layout");
}
