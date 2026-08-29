/**
 * Yapay zeka anahtarinin CALISMA ZAMANI kaynagi.
 *
 * Onceden tek kaynak `.env` dosyasiydi: anahtari degistirmek sunucuya
 * erisim + yeniden baslatma gerektiriyordu. Musteri kendi anahtarini kendi
 * giremiyordu. Artik anahtar veritabaninda durur ve sistem yoneticisi
 * `/dashboard/sistem/api` ekranindan yonetir.
 *
 * ONCELIK: panel kaydi > .env. Panelde gecerli bir anahtar varsa .env'deki
 * deger YOK SAYILIR; panel bosaltilirsa .env yedege duser. Boylece kurulumu
 * yapan gelistiricinin anahtari ile musterinin kendi anahtari yan yana
 * yasayabilir ve panel her zaman son sozu soyler.
 *
 * GUVENLIK: ham anahtar yalnizca BU MODULDEN ve yalnizca service_role
 * istemcisiyle okunur. Tablo RLS ile tumuyle kapalidir; oturum acmis bir
 * kullanicinin (sistem yoneticisi dahil) tarayicisi anahtari hicbir yoldan
 * cekemez. Arayuze yalnizca maskelenmis ozet gider (bkz. `getAiSettingsView`).
 *
 * Bu modulu bir Client Component'ten import ETMEYIN.
 */

import { cache } from "react";

import {
  looksLikeRealKey,
  maskApiKey,
  providerInfo,
  isAiProvider,
  type AiProvider,
} from "@/lib/ai-providers";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase-server";
import type { AiSettingsRecord } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Tablo                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `public.ai_settings` tablosunun tek satiri.
 *
 * Sema tanimi `lib/types.ts` icinde; burada yalnizca kisa bir ad veriliyor.
 */
export type AiSettingsRow = AiSettingsRecord;

/**
 * Kaydin okunma sonucu.
 *
 * "Kayit yok" ile "okuyamadim" AYRI seylerdir: birincisinde .env yedegine
 * duseriz ve her sey normaldir, ikincisinde yoneticiye kurulumun eksik
 * oldugunu SOYLEMEK gerekir - aksi halde panele anahtar yazar, hicbir sey
 * degismez ve sebebini goremez.
 */
type StoredSettings =
  | { status: "ok"; row: AiSettingsRow | null }
  | { status: "unavailable"; reason: string };

/**
 * Panel kaydini okur. Hicbir kosulda FIRLATMAZ.
 *
 * `cache()` ile sarmali: ayni istekte hem sayfa hem de birden fazla yapay
 * zeka cagrisi bunu cagirabilir; veritabanina yalnizca bir kez gidilir.
 * Onbellek istek bitince silinir.
 */
const loadStoredSettings = cache(async (): Promise<StoredSettings> => {
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
    const { data, error } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) {
      // Tablo hic yoksa migration calistirilmamistir; mesaji yoneticinin
      // dogrudan uygulayabilecegi bir talimata cevirelim.
      const missingTable = /relation .* does not exist|schema cache|PGRST205/i.test(
        `${error.message} ${error.code ?? ""}`,
      );

      return {
        status: "unavailable",
        reason: missingTable
          ? "Veritabanında ai_settings tablosu yok. supabase/migrations/uygulandi/2026-08-28-yapay-zeka-anahtarlari.sql dosyasını çalıştırın."
          : `Ayarlar okunamadı: ${error.message}`,
      };
    }

    return { status: "ok", row: normalizeRow(data) };
  } catch (caught) {
    return {
      status: "unavailable",
      reason: caught instanceof Error ? caught.message : "Ayarlar okunamadı.",
    };
  }
});

/** Veritabanindan gelen satiri guvenli bicime cevirir. */
function normalizeRow(data: unknown): AiSettingsRow | null {
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

/**
 * Yapay zeka cagrilarinin kullanacagi nihai yapilandirma.
 *
 * Anahtar yoksa `mockMode` zorla acilir: aksi halde her istek 401 ile duser
 * ve kullanici hatanin sebebini goremez.
 */
export async function resolveAiConfig(): Promise<AiRuntimeConfig> {
  const stored = await loadStoredSettings();
  const row = stored.status === "ok" ? stored.row : null;

  if (row && looksLikeRealKey(row.api_key)) {
    const info = providerInfo(row.provider);
    const generation = row.model_generation.trim() || info.defaultModel;

    return {
      provider: row.provider,
      apiKey: row.api_key.trim(),
      baseUrl: row.base_url.trim() || info.baseUrl,
      modelGeneration: generation,
      modelGrading: row.model_grading.trim() || generation,
      mockMode: row.mock_mode,
      source: "panel",
    };
  }

  return {
    provider: serverEnv.aiProvider,
    apiKey: serverEnv.openaiApiKey,
    baseUrl: serverEnv.openaiBaseUrl,
    modelGeneration: serverEnv.aiModelGeneration,
    modelGrading: serverEnv.aiModelGrading,
    // Panelde "simülasyon" isaretlendiyse anahtar .env'den gelse bile gecerlidir:
    // yonetici bilincli olarak modeli devre disi birakmistir.
    mockMode: serverEnv.aiMockMode || row?.mock_mode === true,
    source: serverEnv.openaiApiKey ? "env" : "yok",
  };
}

/* -------------------------------------------------------------------------- */
/*  Yonetim ekrani icin maskeli ozet                                          */
/* -------------------------------------------------------------------------- */

export interface AiSettingsView {
  /** Panelde secili saglayici (kayit yoksa .env'den tahmin edilen). */
  provider: AiProvider;
  /** Panelde kayitli bir anahtar var mi? */
  hasKey: boolean;
  /** `sk-p••••••a91F` bicimi. Ham anahtar ASLA gonderilmez. */
  keyHint: string;
  baseUrl: string;
  modelGeneration: string;
  modelGrading: string;
  mockMode: boolean;
  updatedAt: string | null;
  /** Ayari en son degistiren kisinin adi. */
  updatedBy: string | null;
  /** Su an hangi kaynak gecerli. */
  source: AiConfigSource;
  /** .env icinde de anahtar var mi? Panel bosaltilirsa buraya dusulur. */
  envKeyPresent: boolean;
  envProvider: AiProvider;
  /** Panel kaydi calisma aninda okunabiliyor mu? */
  storageReady: boolean;
  /** `storageReady` false ise sebebi. */
  storageError: string | null;
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
  const row = stored.status === "ok" ? stored.row : null;
  const config = await resolveAiConfig();

  const provider = row?.provider ?? serverEnv.aiProvider;

  return {
    provider,
    hasKey: looksLikeRealKey(row?.api_key),
    keyHint: row?.api_key ? maskApiKey(row.api_key) : "",
    baseUrl: row?.base_url ?? "",
    modelGeneration: row?.model_generation ?? "",
    modelGrading: row?.model_grading ?? "",
    mockMode: row?.mock_mode ?? false,
    updatedAt: row?.updated_at || null,
    updatedBy: await resolveEditorName(row?.updated_by ?? null),
    source: config.source,
    envKeyPresent: looksLikeRealKey(serverEnv.openaiApiKey),
    envProvider: serverEnv.aiProvider,
    storageReady: stored.status === "ok",
    storageError: stored.status === "unavailable" ? stored.reason : null,
  };
}

/** Ayari son degistiren kullanicinin adi. Bulunamazsa `null`. */
async function resolveEditorName(userId: string | null): Promise<string | null> {
  if (!userId || !serverEnv.supabaseServiceRoleKey) return null;

  try {
    const supabase = createAdminSupabaseClient();
    const { data } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!data) return null;
    return data.full_name || data.email || null;
  } catch {
    return null;
  }
}
