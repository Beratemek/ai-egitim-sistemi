/**
 * Cevre degiskenlerinin tek giris noktasi.
 *
 * NOT: Next.js, `process.env.NEXT_PUBLIC_*` ifadelerini derleme aninda
 * *statik olarak* degistirir. Bu yuzden degiskenlere dinamik anahtarla
 * (`process.env[key]`) erisilmez; her biri acikca yazilir.
 */

function required(value: string | undefined, name: string): string {
  if (!value || value.length === 0) {
    throw new Error(
      `[env] "${name}" tanimli degil. .env.example dosyasini .env.local olarak kopyalayip doldurun.`,
    );
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value && value.length > 0 ? value : fallback;
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (value && value.length > 0) return value;
  }
  return "";
}

/**
 * Supabase 2025'te tarayici anahtarini yeniden adlandirdi:
 * eski `anon` (JWT) -> yeni `publishable` (`sb_publishable_...`).
 * Dashboard'daki "Connect" ekrani artik yeni ismi veriyor, cogu ornek ise
 * hala eskisini kullaniyor. Ikisini de kabul ediyoruz ki hangi ismi
 * yazdiginizin onemi kalmasin.
 */
const supabaseBrowserKey = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** Tarayiciya da gonderilebilen, herkese acik degiskenler. */
export const publicEnv = {
  supabaseUrl: optional(process.env.NEXT_PUBLIC_SUPABASE_URL, ""),
  supabaseAnonKey: supabaseBrowserKey,
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
} as const;

/** Supabase yapilandirilmis mi? (Demo modunda calisabilmek icin kontrol edilir.) */
export const isSupabaseConfigured: boolean =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;

/** Supabase degiskenlerini zorunlu kilarak dondurur. */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: required(publicEnv.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required(
      publicEnv.supabaseAnonKey,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (veya NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    ),
  };
}

/**
 * `.env.example` icindeki yer tutucular (`sk-...`, `eyJhbGciOi...`) kopyalanip
 * oldugu gibi birakilirsa gercek anahtar sanilip API'ye gonderilir ve 401 alinir.
 * Gercek bir OpenAI anahtari her zaman 20 karakterden uzundur; kisa degerleri
 * "tanimlanmamis" sayiyoruz.
 */
function looksLikeRealKey(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 20;
}

const openaiApiKey = looksLikeRealKey(process.env.OPENAI_API_KEY)
  ? process.env.OPENAI_API_KEY.trim()
  : "";

/**
 * Yalnizca sunucu tarafinda okunmali. Bu modulu bir Client Component'ten
 * import etmeyin; degerler `undefined` doner ve gizli anahtar sizmaz.
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey,
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "",
  aiModelGeneration: optional(process.env.AI_MODEL_GENERATION, "gpt-4o-mini"),
  aiModelGrading: optional(process.env.AI_MODEL_GRADING, "gpt-4o-mini"),
  /**
   * Gecerli bir API anahtari yoksa veya AI_MOCK_MODE=true ise sahte cevap
   * uretilir. Anahtar yokken AI_MOCK_MODE=false yazmak mock modu kapatmaz -
   * aksi halde her istek 401 ile duserdi.
   */
  aiMockMode: process.env.AI_MOCK_MODE === "true" || openaiApiKey.length === 0,
} as const;
