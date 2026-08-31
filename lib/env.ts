/**
 * Cevre degiskenlerinin tek giris noktasi.
 *
 * NOT: Next.js, `process.env.NEXT_PUBLIC_*` ifadelerini derleme aninda
 * *statik olarak* degistirir. Bu yuzden degiskenlere dinamik anahtarla
 * (`process.env[key]`) erisilmez; her biri acikca yazilir.
 */

import {
  detectProvider,
  isAiProvider,
  looksLikeRealKey,
  providerInfo,
  type AiProvider,
} from "@/lib/ai-providers";

export { AI_PROVIDERS, type AiProvider } from "@/lib/ai-providers";

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
 * Gercek bir API anahtari (OpenAI, Gemini, Groq...) her zaman 20 karakterden
 * uzundur; kisa degerleri "tanimlanmamis" sayiyoruz.
 */
const rawApiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
const openaiApiKey = looksLikeRealKey(rawApiKey) ? rawApiKey : "";

/* -------------------------------------------------------------------------- */
/*  Yapay zeka saglayicisi                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Hangi saglayici kullanilacak?
 *
 * `AI_PROVIDER` acikca yazilmissa o gecerlidir. Yazilmamissa anahtarin
 * onekinden tahmin edilir (bkz. `detectProvider`); boylece ekipten biri
 * sadece anahtari degistirdiginde de dogru saglayici secilir.
 *
 * NOT: Bu yalnizca .ENV yolu icindir. Sistem yoneticisi panelden bir anahtar
 * kaydettiginde saglayici oradan gelir ve buradaki tahmin devreye girmez
 * (bkz. lib/ai-settings.ts).
 */
function resolveProvider(key: string): AiProvider {
  const explicit = process.env.AI_PROVIDER?.trim().toLocaleLowerCase("en");
  if (isAiProvider(explicit)) return explicit;
  return detectProvider(key) ?? "openai";
}

const aiProvider = resolveProvider(openaiApiKey);

/**
 * Saglayiciya gore varsayilan model - yanlis model adiyla 404 alinmasin.
 *
 * NOT: Google eski modelleri yeni anahtarlara kapatiyor ("no longer available
 * to new users"). Model adi kapanirsa `AI_MODEL_GENERATION` ile ezin ya da
 * "gemini-flash-latest" takma adini kullanin. Kullanilabilir modeller:
 *   curl "https://generativelanguage.googleapis.com/v1beta/models?key=ANAHTAR"
 */
const defaultModel = providerInfo(aiProvider).defaultModel;

/**
 * Yalnizca sunucu tarafinda okunmali. Bu modulu bir Client Component'ten
 * import etmeyin; degerler `undefined` doner ve gizli anahtar sizmaz.
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** Saglayicidan bagimsiz API anahtari (OPENAI_API_KEY alanindan okunur). */
  openaiApiKey,
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "",
  aiProvider,
  aiModelGeneration: optional(process.env.AI_MODEL_GENERATION, defaultModel),
  aiModelGrading: optional(process.env.AI_MODEL_GRADING, defaultModel),
  /**
   * Gecerli bir API anahtari yoksa veya AI_MOCK_MODE=true ise sahte cevap
   * uretilir. Anahtar yokken AI_MOCK_MODE=false yazmak mock modu kapatmaz -
   * aksi halde her istek 401 ile duserdi.
   */
  aiMockMode: process.env.AI_MOCK_MODE === "true" || openaiApiKey.length === 0,
} as const;
