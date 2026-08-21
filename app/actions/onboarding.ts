"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { ROLE_CACHE_COOKIE } from "@/lib/auth-cookies";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";
import { isRoleStatus, type RoleStatus, type UserRole } from "@/lib/types";

/**
 * Rol secimi ve onayi.
 *
 * Rol alanlari uygulamadan DOGRUDAN yazilmaz; veritabanindaki iki
 * SECURITY DEFINER fonksiyonu uzerinden gecer (bkz. supabase/schema.sql):
 *   * request_role()        - kullanici kendi adina rol talep eder
 *   * review_role_request() - yalnizca egitim yoneticisi karar verir
 *
 * Boylece "kendi satirimi guncelleyip yonetici olurum" yolu kapalidir; tablo
 * uzerindeki tetikleyici dogrudan yazmayi zaten reddeder.
 */

/**
 * Middleware rolu kisa sureli bir cerezde onbellekliyor. Rol degistiginde
 * bu cerez temizlenmezse kullanici 5 dakika boyunca eski rolune gore
 * yonlendirilir - secim ekranindan cikamaz.
 */
async function clearRoleCache(): Promise<void> {
  try {
    (await cookies()).delete(ROLE_CACHE_COOKIE);
  } catch {
    // Server Action disinda cagrilirsa cerez yazilamaz; yonlendirme yine
    // en gec onbellek suresi dolunca duzelir.
  }
}

/** Kullanicinin kendi adina rol talep etmesi. */
export async function requestRole(
  target: UserRole,
): Promise<ActionResult<{ status: RoleStatus }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum acmaniz gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("request_role", { target });

  if (error) return { ok: false, error: error.message };
  if (!isRoleStatus(data)) {
    return { ok: false, error: "Rol talebi kaydedilemedi." };
  }

  await clearRoleCache();

  revalidatePath("/", "layout");

  return { ok: true, data: { status: data } };
}
