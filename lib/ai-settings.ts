/**
 * Yapay zeka anahtarlarinin CALISMA ZAMANI kaynagi.
 *
 * Onceden tek kaynak `.env` dosyasiydi: anahtari degistirmek sunucuya erisim +
 * yeniden baslatma gerektiriyordu, musteri kendi anahtarini giremiyordu. Artik
 * anahtarlar veritabaninda durur ve sistem yoneticisi `/dashboard/sistem/api`
 * ekranindan yonetir.
 *
 * COKLU SAGLAYICI: her saglayicinin kendi satiri vardir (`ai_provider_keys`),
 * hepsi ayni anda tanimli kalabilir. `ai_settings` yalnizca GENEL tercihleri
 * tutar - varsayilan saglayici, puanlama modeli, simulasyon anahtari.
 * Boylece icerik uzmani model listesinde hem Gemini hem OpenRouter modellerini
 * bir arada gorur ve sectigi modelin anahtari kendiliginden kullanilir.
 *
 * ONCELIK: panel kaydi > .env. Panelde gecerli bir anahtar varsa .env'deki
 * deger YOK SAYILIR; panel bosaltilirsa .env yedege duser.
 *
 * GUVENLIK: ham anahtar yalnizca BU MODULDEN ve yalnizca service_role
 * istemcisiyle okunur. Iki tablo da RLS ile tumuyle kapalidir; oturum acmis bir
 * kullanicinin -sistem yoneticisi DAHIL- tarayicisi anahtari hicbir yoldan
 * cekemez. Arayuze yalnizca maskelenmis ozet gider (`getAiSettingsView`).
 *
 * Bu modulu bir Client Component'ten import ETMEYIN.
 */

import { cache } from "react";

import {
  AI_PROVIDERS,
  isAiProvider,
  looksLikeRealKey,
  maskApiKey,
  providerInfo,
  type AiProvider,
} from "@/lib/ai-providers";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { AiProviderKeyRecord, AiSettingsRecord } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Tablolar                                                                  */
/* -------------------------------------------------------------------------- */

/** Genel tercihler (`ai_settings`, tek satir). */
export type AiSettingsRow = AiSettingsRecord;

/** Saglayici basina anahtar (`ai_provider_keys`). */
export type AiProviderKeyRow = AiProviderKeyRecord;

/**
 * Okuma sonucu.
 *
 * "Kayit yok" ile "okuyamadim" AYRI seylerdir: birincisinde .env yedegine
 * duseriz ve her sey normaldir, ikincisinde yoneticiye kurulumun eksik
 * oldugunu SOYLEMEK gerekir - aksi halde panele anahtar yazar, hicbir sey
 * degismez ve sebebini goremez.
 */
type StoredSettings =
  | { status: "ok"; row: AiSettingsRow | null; keys: AiProviderKeyRow[] }
  | { status: "unavailable"; reason: string };

/**
 * Panel kayitlarini okur. Hicbir kosulda FIRLATMAZ.
 *
 * `cache()` ile sarmali: ayni istekte hem sayfa hem de birden fazla yapay zeka
 * cagrisi bunu cagirabilir; veritabanina yalnizca bir kez gidilir. Onbellek
 * istek bitince silinir.
 */
/**
 * Ayar kaydinin SUREC ICI onbellegi.
 *
 * `cache()` yalnizca TEK bir istek boyunca dedupe ediyor. Ayarlar her dashboard
 * sayfasinda okundugu icin (simulasyon uyarisi, model listesi) bu, her sayfa
 * gecisine bir veritabani gidis-donusu ekliyordu - uzak bir Supabase orneginde
 * gorunur bir gecikme.
 *
 * Sure KISA tutuluyor: panelden anahtar kaydeden yonetici sonucu hemen
 * gormeli. On saniye, "her gecise bir sorgu" ile "ayar degisikligi gecikir"
 * arasindaki dengede duruyor.
 */
const SETTINGS_TTL_MS = 10_000;
let settingsCache: { at: number; value: StoredSettings } | null = null;

const loadStoredSettings = cache(async (): Promise<StoredSettings> => {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }

  const fresh = await readStoredSettings();
  settingsCache = { at: Date.now(), value: fresh };
  return fresh;
});

/** Panelden yazma yapildiginda onbellegi dusurur. */
export function invalidateAiSettingsCache(): void {
  settingsCache = null;
}

async function readStoredSettings(): Promise<StoredSettings> {
  if (!isSupabaseConfigured) {
    return { status: "unavailable", reason: "Supabase bağlantısı yapılandırılmamış." };
  }

  if (!serverEnv.supabaseServiceRoleKey) {
    return {
      status: "unavailable",
      reason:
        "SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Panelden girilen anahtar saklanabilir ama çalışma anında okunamaz.",
    };
  }

  try {
    const supabase = createAdminSupabaseClient();

    const [settings, keys] = await Promise.all([
      supabase.from("ai_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("ai_provider_keys").select("*"),
    ]);

    const failure = settings.error ?? keys.error;
    if (failure) {
      const missingTable = /relation .* does not exist|schema cache|PGRST205/i.test(
        `${failure.message} ${failure.code ?? ""}`,
      );

      return {
        status: "unavailable",
        reason: missingTable
          ? "Veritabanı tabloları eksik. Hangi adımın eksik olduğunu `npm run migration:durum` söyler; ilgili SQL dosyasını Supabase SQL Editor'de çalıştırın."
          : `Ayarlar okunamadı: ${failure.message}`,
      };
    }

    return {
      status: "ok",
      row: normalizeSettings(settings.data),
      keys: (keys.data ?? [])
        .map(normalizeProviderKey)
        .filter((row): row is AiProviderKeyRow => row !== null),
    };
  } catch (caught) {
    return {
      status: "unavailable",
      reason: caught instanceof Error ? caught.message : "Ayarlar okunamadı.",
    };
  }
}

function normalizeSettings(data: unknown): AiSettingsRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Partial<AiSettingsRow>;

  return {
    id: true,
    provider: isAiProvider(row.provider) ? row.provider : "openai",
    api_key: typeof row.api_key === "string" ? row.api_key : "",
    base_url: typeof row.base_url === "string" ? row.base_url : "",
    model_generation:
      typeof row.model_generation === "string" ? row.model_generation : "",
    model_grading: typeof row.model_grading === "string" ? row.model_grading : "",
    mock_mode: row.mock_mode === true,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
  };
}

function normalizeProviderKey(data: unknown): AiProviderKeyRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Partial<AiProviderKeyRow>;
  if (!isAiProvider(row.provider)) return null;

  return {
    provider: row.provider,
    api_key: typeof row.api_key === "string" ? row.api_key : "",
    base_url: typeof row.base_url === "string" ? row.base_url : "",
    model_generation:
      typeof row.model_generation === "string" ? row.model_generation : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    updated_by: typeof row.updated_by === "string" ? row.updated_by : null,
  };
}

/**
 * Saglayici -> anahtar esleme.
 *
 * `ai_settings.api_key` GERIYE DONUK olarak okunuyor: BEKLEYEN-4 calistirilmadan
 * once girilmis anahtar orada duruyor olabilir ve migration'i beklerken
 * uygulamanin calismayi birakmasi kabul edilemez. Yeni tablodaki kayit her
 * zaman onceliklidir.
 */
function keyMap(stored: StoredSettings): Map<AiProvider, AiProviderKeyRow> {
  const map = new Map<AiProvider, AiProviderKeyRow>();
  if (stored.status !== "ok") return map;

  if (stored.row && looksLikeRealKey(stored.row.api_key)) {
    map.set(stored.row.provider, {
      provider: stored.row.provider,
      api_key: stored.row.api_key,
      base_url: stored.row.base_url,
      model_generation: stored.row.model_generation,
      updated_at: stored.row.updated_at,
      updated_by: stored.row.updated_by,
    });
  }

  for (const row of stored.keys) {
    if (looksLikeRealKey(row.api_key)) map.set(row.provider, row);
  }

  return map;
}

/* -------------------------------------------------------------------------- */
/*  Calisma zamani yapilandirmasi                                             */
/* -------------------------------------------------------------------------- */

/** Ayarin nereden geldigi. */
export type AiConfigSource = "panel" | "env" | "yok";

export interface AiRuntimeConfig {
  provider: AiProvider;
  /** Ham anahtar. ARAYUZE ASLA GONDERILMEZ. */
  apiKey: string;
  /** OpenAI uyumlu saglayicilarin taban adresi; bos ise varsayilan kullanilir. */
  baseUrl: string;
  modelGeneration: string;
  modelGrading: string;
  /** Gercek model cagrisi yerine deterministik sahte veri uretilsin mi? */
  mockMode: boolean;
  source: AiConfigSource;
}

/** Kayitli satirdan calisma yapilandirmasi kurar. */
function configFromKey(
  row: AiProviderKeyRow,
  settings: AiSettingsRow | null,
): AiRuntimeConfig {
  const info = providerInfo(row.provider);
  const generation = row.model_generation.trim() || info.defaultModel;

  return {
    provider: row.provider,
    apiKey: row.api_key.trim(),
    baseUrl: row.base_url.trim() || info.baseUrl,
    modelGeneration: generation,
    modelGrading: settings?.model_grading.trim() || generation,
    mockMode: settings?.mock_mode === true,
    source: "panel",
  };
}

/** Panelde hicbir anahtar yoksa .env yedegi. */
function configFromEnv(settings: AiSettingsRow | null): AiRuntimeConfig {
  return {
    provider: serverEnv.aiProvider,
    apiKey: serverEnv.openaiApiKey,
    baseUrl: serverEnv.openaiBaseUrl,
    modelGeneration: serverEnv.aiModelGeneration,
    modelGrading: serverEnv.aiModelGrading,
    // Panelde "simülasyon" isaretlendiyse anahtar .env'den gelse bile gecerlidir:
    // yonetici bilincli olarak modeli devre disi birakmistir.
    mockMode: serverEnv.aiMockMode || settings?.mock_mode === true,
    source: serverEnv.openaiApiKey ? "env" : "yok",
  };
}

/**
 * VARSAYILAN yapilandirma: puanlama ve model secilmeden yapilan uretimler.
 *
 * Anahtar yoksa `mockMode` zorla acilir: aksi halde her istek 401 ile duser ve
 * kullanici hatanin sebebini goremez.
 */
export async function resolveAiConfig(): Promise<AiRuntimeConfig> {
  const stored = await loadStoredSettings();
  const settings = stored.status === "ok" ? stored.row : null;
  const keys = keyMap(stored);

  const preferred = settings?.provider ?? serverEnv.aiProvider;
  const row = keys.get(preferred) ?? firstKey(keys);

  return row ? configFromKey(row, settings) : configFromEnv(settings);
}

/**
 * BELIRLI bir saglayicinin yapilandirmasi.
 *
 * Icerik uzmani model listesinden baska bir saglayicinin modelini sectiginde
 * kullanilir. O saglayicinin anahtari yoksa `null` doner ve cagiran taraf
 * istegi reddeder - yanlislikla varsayilan saglayiciya duserek beklenmedik bir
 * modelle (ve faturayla) uretim yapmak istemeyiz.
 */
export async function resolveAiConfigFor(
  provider: AiProvider,
): Promise<AiRuntimeConfig | null> {
  const stored = await loadStoredSettings();
  const settings = stored.status === "ok" ? stored.row : null;
  const row = keyMap(stored).get(provider);

  if (row) return configFromKey(row, settings);

  // .env anahtari da bir saglayiciya ait; istenen oysa onu kullanabiliriz.
  const fallback = configFromEnv(settings);
  return fallback.provider === provider && fallback.apiKey ? fallback : null;
}

/** Haritadaki ilk anahtar - varsayilan saglayicinin anahtari silinmisse. */
function firstKey(
  keys: Map<AiProvider, AiProviderKeyRow>,
): AiProviderKeyRow | undefined {
  for (const provider of AI_PROVIDERS) {
    const row = keys.get(provider);
    if (row) return row;
  }
  return undefined;
}

/**
 * Anahtari tanimli saglayicilar.
 *
 * `.env` anahtari da SAYILIR. Onceden yalnizca veritabani kayitlarina
 * bakiliyordu ve bu bir celiski uretiyordu: `resolveAiConfig()` .env'e
 * dusup soru uretebiliyor, ama model listesi bos geliyordu - "calisan bir
 * anahtar var, listede hicbir model yok". Panelde hic kayit yokken de
 * kurulumun calismasi gerekir.
 */
export async function configuredProviders(): Promise<AiProvider[]> {
  const stored = await loadStoredSettings();
  const providers = [...keyMap(stored).keys()];

  if (
    looksLikeRealKey(serverEnv.openaiApiKey) &&
    !providers.includes(serverEnv.aiProvider)
  ) {
    providers.push(serverEnv.aiProvider);
  }

  return providers;
}

/* -------------------------------------------------------------------------- */
/*  Yonetim ekrani icin maskeli ozet                                          */
/* -------------------------------------------------------------------------- */

export interface AiProviderKeyView {
  provider: AiProvider;
  /** Panelde kayitli bir anahtar var mi? */
  hasKey: boolean;
  /** `sk-p••••••a91F` bicimi. Ham anahtar ASLA gonderilmez. */
  keyHint: string;
  baseUrl: string;
  modelGeneration: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AiSettingsView {
  /** Varsayilan saglayici: model secilmeden yapilan islerde bu kullanilir. */
  provider: AiProvider;
  /** BES saglayicinin hepsi listelenir; anahtari olmayanlar `hasKey: false`. */
  providers: AiProviderKeyView[];
  modelGrading: string;
  mockMode: boolean;
  /** Su an hangi kaynak gecerli. */
  source: AiConfigSource;
  /** .env icinde de anahtar var mi? Panel bosaltilirsa buraya dusulur. */
  envKeyPresent: boolean;
  envProvider: AiProvider;
  /** Panel kaydi calisma aninda okunabiliyor mu? */
  storageReady: boolean;
  /** `storageReady` false ise sebebi. */
  storageError: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Yonetim ekraninin ihtiyaci olan her sey - ham anahtar HARIC.
 *
 * Sayfa bir Server Component; bu ozet istemciye prop olarak gecer. Ham
 * anahtarin buradan cikmamasi, anahtarin tarayiciya hic ulasmamasinin tek
 * garantisidir.
 */
export async function getAiSettingsView(): Promise<AiSettingsView> {
  const stored = await loadStoredSettings();
  const settings = stored.status === "ok" ? stored.row : null;
  const keys = keyMap(stored);
  const config = await resolveAiConfig();

  const editors = await resolveEditorNames([
    settings?.updated_by ?? null,
    ...[...keys.values()].map((row) => row.updated_by),
  ]);

  return {
    provider: settings?.provider ?? serverEnv.aiProvider,
    providers: AI_PROVIDERS.map((provider) => {
      const row = keys.get(provider);
      return {
        provider,
        hasKey: Boolean(row),
        keyHint: row ? maskApiKey(row.api_key) : "",
        baseUrl: row?.base_url ?? "",
        modelGeneration: row?.model_generation ?? "",
        updatedAt: row?.updated_at || null,
        updatedBy: row?.updated_by ? (editors.get(row.updated_by) ?? null) : null,
      };
    }),
    modelGrading: settings?.model_grading ?? "",
    mockMode: settings?.mock_mode ?? false,
    source: config.source,
    envKeyPresent: looksLikeRealKey(serverEnv.openaiApiKey),
    envProvider: serverEnv.aiProvider,
    storageReady: stored.status === "ok",
    storageError: stored.status === "unavailable" ? stored.reason : null,
    updatedAt: settings?.updated_at || null,
    updatedBy: settings?.updated_by
      ? (editors.get(settings.updated_by) ?? null)
      : null,
  };
}

/** Ayari degistiren kullanicilarin adlari; tek sorguda toplanir. */
async function resolveEditorNames(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0 || !serverEnv.supabaseServiceRoleKey) return new Map();

  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", unique);

    return new Map(
      (data ?? []).map((row) => [row.id, row.full_name || row.email || ""]),
    );
  } catch {
    return new Map();
  }
}
