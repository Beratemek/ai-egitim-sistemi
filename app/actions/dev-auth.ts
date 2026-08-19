"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DEV_ROLE_COOKIE, isDevRoleSwitchEnabled } from "@/lib/dev-mode";
import { dashboardPathFor } from "@/lib/roles";
import { isUserRole, type UserRole } from "@/lib/types";

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
