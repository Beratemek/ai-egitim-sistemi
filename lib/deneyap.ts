/**
 * DENEYAP Teknoloji Atolyeleri ders dallari.
 *
 * Uretilen her soru bir atolye dalina baglanir; boylece havuz dal bazinda
 * filtrelenebilir ve hangi icerigin hangi atolyeye ait oldugu kaybolmaz.
 * Liste DENEYAP'in resmi 11 dalidir ve `supabase/schema.sql` icindeki
 * `deneyap_category` enum'u ile BIREBIR AYNI sirada tutulmalidir.
 */

export const DENEYAP_CATEGORIES = [
  "yazilim_teknolojileri",
  "siber_guvenlik",
  "ileri_robotik",
  "enerji_teknolojileri",
  "tasarim_ve_uretim",
  "mobil_uygulama",
  "elektronik_programlama_ve_iot",
  "yapay_zeka",
  "havacilik_ve_uzay",
  "robotik_ve_kodlama",
  "nanoteknoloji_ve_malzeme",
] as const;

export type DeneyapCategory = (typeof DENEYAP_CATEGORIES)[number];

export function isDeneyapCategory(value: unknown): value is DeneyapCategory {
  return (
    typeof value === "string" &&
    (DENEYAP_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Arayuzde gosterilen dal adlari.
 *
 * Etiketler projenin geri kalaniyla tutarli olsun diye ASCII yazilmistir
 * (bkz. lib/roles.ts). Modele gonderilirken de bu ad kullanilir.
 */
export const DENEYAP_CATEGORY_LABELS: Record<DeneyapCategory, string> = {
  yazilim_teknolojileri: "Yazılım Teknolojileri",
  siber_guvenlik: "Siber Güvenlik",
  ileri_robotik: "İleri Robotik",
  enerji_teknolojileri: "Enerji Teknolojileri",
  tasarim_ve_uretim: "Tasarım ve Üretim",
  mobil_uygulama: "Mobil Uygulama",
  elektronik_programlama_ve_iot: "Elektronik Programlama ve Nesnelerin İnterneti",
  yapay_zeka: "Yapay Zekâ",
  havacilik_ve_uzay: "Havacılık ve Uzay Teknolojileri",
  robotik_ve_kodlama: "Robotik ve Kodlama",
  nanoteknoloji_ve_malzeme: "Nanoteknoloji ve Malzeme Bilimi",
};

/** Dal adini dondurur; taninmayan deger icin "Kategori yok". */
export function categoryLabel(value: string | null | undefined): string {
  return isDeneyapCategory(value) ? DENEYAP_CATEGORY_LABELS[value] : "Kategori yok";
}

/** Select ve filtre bilesenlerinin dogrudan kullanabilecegi liste. */
export const DENEYAP_CATEGORY_OPTIONS: readonly {
  value: DeneyapCategory;
  label: string;
}[] = DENEYAP_CATEGORIES.map((value) => ({
  value,
  label: DENEYAP_CATEGORY_LABELS[value],
}));
