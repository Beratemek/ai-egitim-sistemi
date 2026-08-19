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

/** Tarayiciya da gonderilebilen, herkese acik degiskenler. */
export const publicEnv = {
  supabaseUrl: optional(process.env.NEXT_PUBLIC_SUPABASE_URL, ""),
  supabaseAnonKey: optional(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, ""),
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
} as const;

/** Supabase yapilandirilmis mi? (Demo modunda calisabilmek icin kontrol edilir.) */
export const isSupabaseConfigured: boolean =
  publicEnv.supabaseUrl.length > 0 && publicEnv.supabaseAnonKey.length > 0;

/** Supabase degiskenlerini zorunlu kilarak dondurur. */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: required(publicEnv.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required(publicEnv.supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/**
 * Yalnizca sunucu tarafinda okunmali. Bu modulu bir Client Component'ten
 * import etmeyin; degerler `undefined` doner ve gizli anahtar sizmaz.
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "",
  aiModelGeneration: optional(process.env.AI_MODEL_GENERATION, "gpt-4o-mini"),
  aiModelGrading: optional(process.env.AI_MODEL_GRADING, "gpt-4o-mini"),
  /** API anahtari yoksa veya AI_MOCK_MODE=true ise sahte cevap uretilir. */
  aiMockMode:
    process.env.AI_MOCK_MODE === "true" || !process.env.OPENAI_API_KEY,
} as const;
