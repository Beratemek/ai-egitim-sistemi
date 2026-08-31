/**
 * Yapay zeka saglayici katalogu.
 *
 * Bu dosyayi HEM sunucu (lib/ai.ts, lib/env.ts, lib/ai-settings.ts) HEM DE
 * tarayici (sistem yoneticisinin "API Anahtarlari" ekrani) okur. Bu yuzden
 * icinde GIZLI HICBIR SEY YOKTUR ve sunucuya ozel bir modul import ETMEZ;
 * yalnizca "hangi saglayici, anahtari hangi bicimde, hangi modeller" bilgisi
 * durur.
 *
 * Anahtarin kendisi asla buraya girmez - o veritabaninda ve yalnizca sunucu
 * tarafinda okunur (bkz. lib/ai-settings.ts).
 */

/* -------------------------------------------------------------------------- */
/*  Saglayicilar                                                              */
/* -------------------------------------------------------------------------- */

export const AI_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "diger",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" &&
    (AI_PROVIDERS as readonly string[]).includes(value)
  );
}

export interface AiProviderInfo {
  id: AiProvider;
  /** Ekranda gorunen ad. */
  label: string;
  /** Kart altyazisi: anahtari kimden aliyoruz. */
  tagline: string;
  /**
   * Anahtar onekleri.
   *
   * Kullanici saglayici secmeden anahtari yapistirdiginda dogru kart
   * kendiliginden isaretlenir - "OpenAI anahtarini Gemini kutusuna yazdim"
   * hatasi bu yuzden neredeyse imkansiz.
   */
  keyPrefixes: readonly string[];
  keyPlaceholder: string;
  /** Model alani bos birakilirsa kullanilan model. */
  defaultModel: string;
  /** Model kutusunun altinda tek tikla secilebilen oneriler. */
  suggestedModels: readonly string[];
  /** Sabit taban adres. Bos ise saglayicinin kendi varsayilani kullanilir. */
  baseUrl: string;
  /** Taban adres kullanicidan isteniyor mu? (yalnizca "diger") */
  requiresBaseUrl: boolean;
  /** Anahtarin alinacagi sayfa. */
  consoleUrl: string;
  consoleLabel: string;
  /** Kartta gosterilen kisa aciklama. */
  note: string;
}

/**
 * Saglayici listesi.
 *
 * Varsayilan modeller BILINCLI olarak ucuz/hizli siniftan secildi: uygulama
 * her soru uretiminde ve her cevap puanlamasinda model cagiriyor, pahali bir
 * varsayilan faturaya dogrudan yansiyor. Kalite gerekirse panelden model
 * degistirilir.
 */
export const AI_PROVIDER_LIST: readonly AiProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    tagline: "GPT modelleri",
    keyPrefixes: ["sk-proj-", "sk-svcacct-"],
    keyPlaceholder: "sk-proj-...",
    defaultModel: "gpt-4o-mini",
    suggestedModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    baseUrl: "",
    requiresBaseUrl: false,
    consoleUrl: "https://platform.openai.com/api-keys",
    consoleLabel: "platform.openai.com",
    note: "Şema zorlamalı çıktıyı (JSON) tam destekler; soru üretimi ve puanlama için en güvenli seçenek.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    tagline: "Claude modelleri",
    keyPrefixes: ["sk-ant-"],
    keyPlaceholder: "sk-ant-api03-...",
    defaultModel: "claude-sonnet-5",
    suggestedModels: [
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-haiku-4-5-20251001",
    ],
    baseUrl: "",
    requiresBaseUrl: false,
    consoleUrl: "https://console.anthropic.com/settings/keys",
    consoleLabel: "console.anthropic.com",
    note: "Uzun Türkçe metinlerde ve rubrik puanlamasında güçlüdür. Ücretsiz katmanı yoktur; kullandıkça ödenir.",
  },
  {
    id: "google",
    label: "Google Gemini",
    tagline: "Google AI Studio",
    keyPrefixes: ["AIza", "AQ."],
    keyPlaceholder: "AIza...",
    defaultModel: "gemini-3.6-flash",
    suggestedModels: ["gemini-3.6-flash", "gemini-flash-latest"],
    baseUrl: "",
    requiresBaseUrl: false,
    consoleUrl: "https://aistudio.google.com/app/apikey",
    consoleLabel: "aistudio.google.com",
    note: "Ücretsiz katmanı vardır ama günlük istek hakkı sınırlıdır; hak dolunca sorular üretilemez.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tagline: "Tek anahtarla yüzlerce model",
    keyPrefixes: ["sk-or-"],
    keyPlaceholder: "sk-or-v1-...",
    defaultModel: "openai/gpt-4o-mini",
    suggestedModels: [],
    baseUrl: "https://openrouter.ai/api/v1",
    requiresBaseUrl: false,
    consoleUrl: "https://openrouter.ai/keys",
    consoleLabel: "openrouter.ai/keys",
    note: "Tek anahtarla farklı firmaların modellerini denersiniz; model listesi ve fiyatları aşağıda canlı gelir.",
  },
  {
    id: "diger",
    label: "Diğer (OpenAI uyumlu)",
    tagline: "Groq, Together, yerel sunucu...",
    keyPrefixes: ["gsk_"],
    keyPlaceholder: "gsk_... / kendi anahtarınız",
    defaultModel: "",
    suggestedModels: ["llama-3.3-70b-versatile"],
    baseUrl: "",
    requiresBaseUrl: true,
    consoleUrl: "",
    consoleLabel: "",
    note: "OpenAI ile aynı arayüzü sunan her servis çalışır. Taban adres ve model adını siz yazarsınız.",
  },
];

const PROVIDER_BY_ID = new Map<AiProvider, AiProviderInfo>(
  AI_PROVIDER_LIST.map((provider) => [provider.id, provider]),
);

/** Katalog kaydini dondurur; bilinmeyen deger icin OpenAI'a duser. */
export function providerInfo(id: AiProvider): AiProviderInfo {
  return PROVIDER_BY_ID.get(id) ?? AI_PROVIDER_LIST[0]!;
}

/**
 * Anahtar onekinden saglayiciyi tahmin eder.
 *
 * Onekler UZUNDAN KISAYA denenir: "sk-or-v1-..." hem OpenRouter'in
 * "sk-or-" onekiyle hem de eski OpenAI anahtarlarinin "sk-" onekiyle
 * eslesir; kisa onek once denenirse OpenRouter anahtari OpenAI sanilir.
 */
const PREFIX_INDEX = AI_PROVIDER_LIST.flatMap((provider) =>
  provider.keyPrefixes.map((prefix) => ({ prefix, id: provider.id })),
).sort((a, b) => b.prefix.length - a.prefix.length);

export function detectProvider(apiKey: string): AiProvider | null {
  const key = apiKey.trim();
  if (!key) return null;

  const match = PREFIX_INDEX.find((entry) => key.startsWith(entry.prefix));
  if (match) return match.id;

  // Onek listesinde olmayan ama "sk-" ile baslayan anahtarlar tarihsel
  // OpenAI bicimidir (sk-...48 karakter).
  return key.startsWith("sk-") ? "openai" : null;
}

/**
 * Anahtari ekranda gosterilebilir hale getirir: `sk-p••••••a91F`.
 *
 * Bas ve son parca birakiliyor ki yonetici "hangi anahtar yuklu" sorusunu
 * anahtari gormeden yanitlayabilsin; ortadaki gizli kisim tek basina ise
 * yaramaz.
 */
export function maskApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return "";
  if (key.length <= 10) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(6)}${key.slice(-4)}`;
}

/**
 * Anahtar gercege benziyor mu?
 *
 * `.env.example` icindeki yer tutucular ("sk-...", "AIza...") kopyalanip
 * oldugu gibi birakiliyordu; gercek anahtar her zaman 20 karakterden uzundur.
 */
export function looksLikeRealKey(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 20;
}
