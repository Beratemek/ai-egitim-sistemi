"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { ROLE_CACHE_COOKIE } from "@/lib/auth-cookies";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured, publicEnv, serverEnv } from "@/lib/env";
import {
  createAdminSupabaseClient,
  createServerSupabaseClient,
  getCurrentUser,
} from "@/lib/supabase-server";
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
): Promise<ActionResult<{ status: RoleStatus; mailSent: boolean }>> {
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

  let mailSent = false;
  if (approve) mailSent = await sendVerificationMail(userId);

  revalidateUserPaths();
  return { ok: true, data: { status: data, mailSent } };
}

/**
 * Onaylanan kullaniciya e-posta dogrulama baglantisi yollar.
 *
 * Yalnizca e-postasi HENUZ DOGRULANMAMIS hesaplara gonderilir; Google ile
 * giren kullanicinin adresi zaten Google tarafindan dogrulanmistir, ona
 * gereksiz mail atmayiz.
 *
 * Gonderim Supabase'in kendi mailer'i uzerinden yapilir. Basarisiz olursa
 * onay islemi geri alinmaz - rol verilmistir, yalnizca mail gitmemistir;
 * cagiran taraf `mailSent` ile bunu kullaniciya soyler.
 */
async function sendVerificationMail(userId: string): Promise<boolean> {
  if (!serverEnv.supabaseServiceRoleKey) return false;

  try {
    const admin = createAdminSupabaseClient();
    const { data: found } = await admin.auth.admin.getUserById(userId);

    const email = found?.user?.email;
    if (!email || found?.user?.email_confirmed_at) return false;

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
    });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Bir kullanicinin ROL KUMESINI belirler (talep beklemeden).
 *
 * Tek rol degil kume: bir hesap hem egitmen hem icerik uzmani olabilir.
 * Aktif rol kumede kalmiyorsa veritabani onu kumenin ilk elemanina duşurur.
 */
export async function setUserRoles(
  userId: string,
  roles: readonly UserRole[],
): Promise<ActionResult<{ roles: UserRole[] }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!userId) return { ok: false, error: "Kullanıcı seçilmedi." };
  if (roles.length === 0) {
    return { ok: false, error: "En az bir rol seçmelisiniz." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_user_roles", {
    target_user: userId,
    new_roles: [...roles],
  });

  if (error) return { ok: false, error: error.message };

  revalidateUserPaths();
  return { ok: true, data: { roles: (data as UserRole[]) ?? [...roles] } };
}

/**
 * Kullanicinin kendi AKTIF rolunu secmesi.
 *
 * Yalnizca kendisine verilmis roller arasindan secilebilir; yetki
 * genisletmez, hangi panelde calisilacagini belirler.
 */
export async function setActiveRole(
  role: UserRole,
): Promise<ActionResult<{ role: UserRole }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_active_role", { target: role });

  if (error) return { ok: false, error: error.message };

  // Middleware rolu kisa sureli cerezde onbellekliyor; temizlenmezse
  // kullanici 5 dakika eski rolunun paneline yonlendirilir.
  try {
    (await cookies()).delete(ROLE_CACHE_COOKIE);
  } catch {
    // Server Action disinda cerez yazilamaz; onbellek suresi dolunca duzelir.
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { role: (data as UserRole) ?? role } };
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
