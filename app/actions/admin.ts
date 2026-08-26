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
import { grantedRoles } from "@/lib/roles";
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
  revalidatePath("/dashboard/sistem/kullanicilar");
  revalidatePath("/dashboard/yonetici");
  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/veli");
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizedUuid(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
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
 * Bir kullaniciyi silmenin NE GOTURECEGI.
 *
 * Diyalog acilinca cagrilir; onay ekraninin somut sayilar gosterebilmesi
 * icin. Onceden hesaplamiyoruz: kullanici listesi her acilista bu sorgulari
 * herkes icin calistirmak zorunda kalirdi, oysa silme nadir bir islem.
 */
export async function getUserDeletionImpact(
  userId: string,
): Promise<
  ActionResult<{ examCount: number; submissionCount: number; isSelf: boolean }>
> {
  if (!isSupabaseConfigured) return demoGuard();

  const targetId = normalizedUuid(userId);
  if (!targetId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };
  if (!grantedRoles(current.profile).includes("admin")) {
    return { ok: false, error: "Bu işlem için sistem yöneticisi olmalısınız." };
  }

  /*
    Servis anahtari yoksa `createAdminSupabaseClient()` FIRLATIR. Onceden
    burada kontrol yoktu: anahtar eksik olan bir kurulumda etki hesabi
    sessizce patliyor, diyalog "hesaplaniyor..." halinde donup kaliyor ve
    silme dugmesi hic aktiflesmiyordu - sebebi ekranda yazmadan.
  */
  if (!serverEnv.supabaseServiceRoleKey) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY tanimli degil; silme ve etki hesabi calismaz.",
    };
  }

  const admin = createAdminSupabaseClient();

  const [exams, submissions] = await Promise.all([
    admin
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", targetId),
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", targetId),
  ]);

  return {
    ok: true,
    data: {
      examCount: exams.count ?? 0,
      submissionCount: submissions.count ?? 0,
      isSelf: targetId === current.user.id,
    },
  };
}

/**
 * Kullaniciyi KALICI olarak siler.
 *
 * Silme `auth.users` uzerinden yapilir; `public.users.id` oraya
 * `on delete cascade` ile bagli oldugu icin profil de birlikte gider.
 * Yalnizca profili silmek hesabi ortada birakirdi: kisi giris yapmaya devam
 * eder, `handle_new_user` tetiklenmedigi icin profili olusmaz ve panel
 * her acilista cokerdi.
 *
 * NE GIDER: kisinin cevaplari, sinav denemeleri, atamalari, calisma plani ve
 * - EGITMENSE - actigi TUM SINAVLAR. Sinavlar giderken onlara bagli baska
 * ogrencilerin teslimleri ve sonuclari da gider (exams.instructor_id
 * `on delete cascade`). Bu yuzden onay ekrani sinav sayisini ayrica soyler.
 *
 * NE KALIR: kisinin YAZDIGI SORULAR ve kazanimlar. Onlarda bag
 * `created_by ... on delete set null`, yani havuz zarar gormez - yalnizca
 * yazari bilinmez olur. Bilincli bir tercih: bir egitmen ayrildi diye ortak
 * soru havuzunun budanmasi istenmez.
 *
 * Servis anahtari GEREKIR: `auth.users` uzerinde silme yetkisi yalnizca
 * service_role'da. Anahtar tanimli degilse islem baslamadan reddedilir.
 */
export async function deleteUser(
  userId: string,
): Promise<ActionResult<{ deletedId: string }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const targetId = normalizedUuid(userId);
  if (!targetId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  /*
    Yetki BURADA dogrulanir.

    Diger islemler yetkisini veritabanindaki SECURITY DEFINER fonksiyonlarina
    birakiyor, ama silme `auth.users`a gidiyor ve orada RLS yok - servis
    anahtari her seyi yapar. Bu yuzden kapiyi burada tutmak zorundayiz.
  */
  if (!grantedRoles(current.profile).includes("admin")) {
    return { ok: false, error: "Bu işlem için sistem yöneticisi olmalısınız." };
  }

  /*
    Kendini silme.

    Teknik olarak calisirdi ama sonucu: oturum acik kalir, profil yoktur,
    panel coker ve geriye sistem yoneticisi olmayan bir kurulum kalabilir.
    Baska bir yoneticinin yapmasi gereken bir is.
  */
  if (targetId === current.user.id) {
    return {
      ok: false,
      error: "Kendi hesabınızı silemezsiniz; bunu başka bir sistem yöneticisi yapmalı.",
    };
  }

  if (!serverEnv.supabaseServiceRoleKey) {
    return {
      ok: false,
      error:
        "Silme icin SUPABASE_SERVICE_ROLE_KEY tanimli olmali; sunucu ortamina ekleyin.",
    };
  }

  const admin = createAdminSupabaseClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);

  if (error) return { ok: false, error: error.message };

  revalidateUserPaths();
  return { ok: true, data: { deletedId: targetId } };
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

/**
 * Bir egitmenin ders yetkilerini belirler.
 *
 * Yetkiyi SISTEM YONETICISI verir: egitmen kendi ders listesini
 * duzenleyebilseydi biyoloji dersini kendine ekleyip Derslik-3'un biyoloji
 * sinavini acabilirdi. Kural veritabaninda da var - `set_instructor_subjects`
 * admin degilse 42501 ile reddeder; buradaki kontrol yalnizca kullaniciya
 * anlamli bir mesaj gostermek icin.
 */
export async function setInstructorSubjects(
  userId: string,
  subjects: readonly string[],
): Promise<ActionResult<{ subjects: string[] }>> {
  if (!isSupabaseConfigured) return demoGuard();
  if (!userId) return { ok: false, error: "Kullanıcı seçilmedi." };

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const cleaned = [
    ...new Set(subjects.map((subject) => subject.trim()).filter(Boolean)),
  ];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_instructor_subjects", {
    target_user: userId,
    subjects: cleaned,
  });

  if (error) {
    if (error.code === "42501") {
      return {
        ok: false,
        error: "Ders yetkisi vermek için sistem yöneticisi olmanız gerekiyor.",
      };
    }
    return { ok: false, error: error.message };
  }

  // Yalnizca yonetim ekranlari tazelenir. Egitmen layout'unu ve profili de
  // gecersiz kilmak, ders yetkisi her isaretlendiginde o agaclari da yeniden
  // kurduruyordu - tek bir tikin maliyetini gereksiz yere buyutuyordu.
  revalidateUserPaths();

  return { ok: true, data: { subjects: (data as string[] | null) ?? cleaned } };
}

/**
 * Bir öğrenciyi tek bir veli hesabına bağlar; `guardianId` boşsa bağlantıyı
 * kaldırır. Veli birden fazla öğrenciye bağlanabilir.
 *
 * Asıl yetki ve rol doğrulaması SECURITY DEFINER `set_student_guardian`
 * fonksiyonundadır. Böylece istemci bu aksiyonu doğrudan çağırsa bile yalnızca
 * sistem yöneticisi, onaylı öğrenci ve onaylı veli arasında işlem yapabilir.
 */
export async function setStudentGuardian(
  studentId: string,
  guardianId: string | null,
): Promise<ActionResult<{ studentId: string; guardianId: string | null }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const normalizedStudentId = normalizedUuid(studentId);
  const normalizedGuardianId = normalizedUuid(guardianId);

  if (!normalizedStudentId) {
    return { ok: false, error: "Geçerli bir öğrenci seçilmedi." };
  }
  if (guardianId?.trim() && !normalizedGuardianId) {
    return { ok: false, error: "Geçerli bir veli seçilmedi." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_student_guardian", {
    target_student: normalizedStudentId,
    target_guardian: normalizedGuardianId,
  });

  if (error) {
    if (error.code === "42501") {
      return {
        ok: false,
        error: "Veli ataması için sistem yöneticisi olmanız gerekiyor.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidateUserPaths();
  revalidatePath(`/dashboard/veli/ogrenciler/${normalizedStudentId}`);

  return {
    ok: true,
    data: {
      studentId: normalizedStudentId,
      guardianId: normalizedGuardianId,
    },
  };
}
