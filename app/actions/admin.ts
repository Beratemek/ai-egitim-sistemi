"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";
import { isRoleStatus, type RoleStatus, type UserRole } from "@/lib/types";

/**
 * Sistem yoneticisinin kullanici islemleri.
 *
 * Rol ve sinif alanlari uygulamadan DOGRUDAN yazilmaz; hepsi veritabanindaki
 * SECURITY DEFINER fonksiyonlarindan gecer (bkz. supabase/migrations).
 * Fonksiyonlar yetkiyi kendileri dogrular, yani bu ekrani atlayip API'ye
 * istek atmak da ise yaramaz.
 */

/** Tum kullanici sayfalarini tazeler. */
function revalidateUserPaths(): void {
  revalidatePath("/dashboard/sistem");
  revalidatePath("/dashboard/yonetici");
  revalidatePath("/dashboard/egitmen");
}

/** Bekleyen bir rol talebini onaylar veya reddeder. */
export async function reviewRoleRequest(
  userId: string,
  approve: boolean,
): Promise<ActionResult<{ status: RoleStatus }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!userId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("review_role_request", {
    target_user: userId,
    approve,
  });

  if (error) return { ok: false, error: error.message };
  if (!isRoleStatus(data)) return { ok: false, error: "Karar kaydedilemedi." };

  revalidateUserPaths();
  return { ok: true, data: { status: data } };
}

/** Bir kullanicinin rolunu dogrudan degistirir (talep beklemeden). */
export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult<{ role: UserRole }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!userId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_user_role", {
    target_user: userId,
    new_role: role,
  });

  if (error) return { ok: false, error: error.message };
  if (typeof data !== "string") {
    return { ok: false, error: "Rol güncellenemedi." };
  }

  revalidateUserPaths();
  return { ok: true, data: { role: data as UserRole } };
}

/** Bir ogrencinin sinifini belirler. Bos deger sinifi kaldirir. */
export async function setUserClassroom(
  userId: string,
  classroom: string,
): Promise<ActionResult<{ classroom: string | null }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!userId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_user_classroom", {
    target_user: userId,
    new_classroom: classroom.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidateUserPaths();
  return { ok: true, data: { classroom: (data as string | null) ?? null } };
}
