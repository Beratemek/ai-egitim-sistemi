import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { GuardianStudentLink } from "@/lib/types";

export interface GuardianAdminData {
  links: GuardianStudentLink[];
  /**
   * Bağlantı sorgusu başarısızsa boş dizi gerçek bir "atama yok" sonucu
   * değildir. Arayüz bu durumda mevcut bir atamayı yanlışlıkla ezmemek için
   * yazma kontrollerini kilitler.
   */
  loadError: string | null;
}

/**
 * Sistem yöneticisinin veli-öğrenci bağlantılarını normal oturum ve RLS ile
 * okur. Burada service-role kullanılmaz; hangi satırların görülebileceğinin
 * yetkisi `guardian_links_select` politikasında kalır.
 */
export async function getGuardianAdminData(): Promise<GuardianAdminData> {
  if (!isSupabaseConfigured) {
    return { links: [], loadError: null };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("guardian_student_links")
    .select("*")
    .order("linked_at", { ascending: false });

  if (error) {
    console.error("[guardian-admin] Veli bağlantıları okunamadı:", error.message);
    return {
      links: [],
      loadError:
        "Veli bağlantıları şu anda okunamadı. Mevcut atamaları korumak için düzenleme geçici olarak kapatıldı.",
    };
  }

  return { links: data ?? [], loadError: null };
}
