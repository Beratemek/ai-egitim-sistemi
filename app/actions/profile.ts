"use server";

import { revalidatePath } from "next/cache";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * Kullanicinin kendi profili.
 *
 * `full_name` rol alanlarindan degildir; `users_update_self` politikasi
 * kullanicinin kendi satirini guncellemesine izin verir ve
 * `guard_role_columns` tetikleyicisi yalnizca rol sutunlarini korur.
 * Bu yuzden ad icin ayri bir SECURITY DEFINER fonksiyonuna gerek yok.
 */

export interface UpdateProfileInput {
  fullName: string;
}

export async function updateProfile(
  input: UpdateProfileInput,
): Promise<ActionResult<{ fullName: string }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const fullName = input.fullName.trim().replace(/\s+/g, " ");

  if (fullName.length < 3) {
    return { ok: false, error: "Ad soyad en az 3 karakter olmalıdır." };
  }

  if (fullName.length > 80) {
    return { ok: false, error: "Ad soyad en fazla 80 karakter olabilir." };
  }

  const current = await getCurrentUser();
  if (!current) return { ok: false, error: "Oturum açmanız gerekiyor." };

  const supabase = await createServerSupabaseClient();

  // `.select()` sart: RLS bir satirla eslesmezse PostgREST hata dondurmez,
  // sessizce 0 satir gunceller ve kullanici "kaydedildi" sanir.
  const { data, error } = await supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", current.user.id)
    .select("full_name");

  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) {
    return { ok: false, error: "Profil kaydedilemedi. Lütfen tekrar deneyin." };
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { fullName } };
}
