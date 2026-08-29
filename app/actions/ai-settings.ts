"use server";

import { revalidatePath } from "next/cache";
import { generateObject } from "ai";
import { z } from "zod";

import { demoGuard, type ActionResult } from "@/app/actions/shared";
import { describeAiError } from "@/lib/ai";
import { createAiModel } from "@/lib/ai-model";
import {
  isAiProvider,
  looksLikeRealKey,
  providerInfo,
  type AiProvider,
} from "@/lib/ai-providers";
import { resolveAiConfig, type AiRuntimeConfig } from "@/lib/ai-settings";
import { isSupabaseConfigured } from "@/lib/env";
import { grantedRoles } from "@/lib/roles";
import { createServerSupabaseClient, getCurrentUser } from "@/lib/supabase-server";

/**
 * Sistem yoneticisinin yapay zeka anahtari islemleri.
 *
 * Yetki IKI kez dogrulanir: burada (erken ve anlasilir bir hata mesaji icin)
 * ve veritabanindaki SECURITY DEFINER fonksiyonlarin icinde (asil kapi).
 * Ikincisi olmasa bu ekrani atlayip PostgREST'e istek atmak yeterdi.
 *
 * Ham anahtar bu dosyadan DISARI CIKMAZ: kaydetmede veritabanina, testte
 * saglayiciya gider; hicbir donus degerinde yer almaz.
 */

export interface AiSettingsInput {
  provider: string;
  /** Bos birakilirsa kayitli anahtar KORUNUR (bkz. save_ai_settings). */
  apiKey: string;
  baseUrl: string;
  modelGeneration: string;
  modelGrading: string;
  mockMode: boolean;
}

/** Dogrulanmis, kirpilmis girdi. */
interface CleanInput {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  modelGeneration: string;
  modelGrading: string;
  mockMode: boolean;
}

/** Sistem yoneticisi mi? Degilse hata mesaji doner. */
async function requireAdmin(): Promise<string | null> {
  const current = await getCurrentUser();
  if (!current) return "Oturum açmanız gerekiyor.";
  if (!grantedRoles(current.profile).includes("admin")) {
    return "Bu ayarı yalnızca sistem yöneticisi değiştirebilir.";
  }
  return null;
}

/**
 * Girdiyi dogrular.
 *
 * Sunucu tarafinda tekrar dogrulaniyor cunku arayuzdeki kontroller yalnizca
 * yardimcidir; action'a dogrudan istek atilabilir.
 */
function validate(input: AiSettingsInput): ActionResult<CleanInput> {
  if (!isAiProvider(input.provider)) {
    return { ok: false, error: "Geçersiz sağlayıcı seçildi." };
  }

  const info = providerInfo(input.provider);
  const apiKey = input.apiKey.trim();
  const baseUrl = input.baseUrl.trim();

  // Bos anahtar "degistirme" demek; yazilmissa gercege benzemeli.
  if (apiKey && !looksLikeRealKey(apiKey)) {
    return {
      ok: false,
      error:
        "Anahtar çok kısa görünüyor. Sağlayıcı panelinden kopyaladığınız değerin tamamını yapıştırın.",
    };
  }

  if (info.requiresBaseUrl && !baseUrl) {
    return {
      ok: false,
      error: "OpenAI uyumlu sağlayıcı için taban adres (base URL) zorunludur.",
    };
  }

  if (baseUrl && !/^https?:\/\/\S+$/i.test(baseUrl)) {
    return {
      ok: false,
      error: "Taban adres http:// veya https:// ile başlamalıdır.",
    };
  }

  return {
    ok: true,
    data: {
      provider: input.provider,
      apiKey,
      baseUrl,
      modelGeneration: input.modelGeneration.trim(),
      modelGrading: input.modelGrading.trim(),
      mockMode: input.mockMode === true,
    },
  };
}

/** Ayarlarin gorundugu her sayfayi tazeler. */
function revalidateAiPaths(): void {
  revalidatePath("/dashboard/sistem/api");
  revalidatePath("/dashboard/egitmen");
  revalidatePath("/dashboard/icerik-uzmani");
}

/* -------------------------------------------------------------------------- */
/*  Kaydetme                                                                  */
/* -------------------------------------------------------------------------- */

export async function saveAiSettings(
  input: AiSettingsInput,
): Promise<ActionResult<{ provider: AiProvider }>> {
  if (!isSupabaseConfigured) return demoGuard();

  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const checked = validate(input);
  if (!checked.ok) return checked;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_ai_settings", {
    new_provider: checked.data.provider,
    new_api_key: checked.data.apiKey,
    new_base_url: checked.data.baseUrl,
    new_model_generation: checked.data.modelGeneration,
    new_model_grading: checked.data.modelGrading,
    new_mock_mode: checked.data.mockMode,
  });

  if (error) return { ok: false, error: describeSaveError(error.message) };

  revalidateAiPaths();
  return { ok: true, data: { provider: checked.data.provider } };
}

/**
 * Kayitli anahtari siler.
 *
 * Ayri bir islem: kaydetmede bos anahtar "degistirme" anlamina geldigi icin
 * silme oradan ifade edilemiyor.
 */
export async function clearAiApiKey(): Promise<ActionResult<undefined>> {
  if (!isSupabaseConfigured) return demoGuard();

  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("clear_ai_api_key", {});

  if (error) return { ok: false, error: describeSaveError(error.message) };

  revalidateAiPaths();
  return { ok: true, data: undefined };
}

/** Migration calistirilmamissa PostgREST'in ham mesaji anlasilmaz olur. */
function describeSaveError(message: string): string {
  if (/save_ai_settings|clear_ai_api_key|PGRST202|does not exist/i.test(message)) {
    return (
      "Veritabanı hazır değil: supabase/migrations/uygulandi/2026-08-28-yapay-zeka-anahtarlari.sql " +
      "dosyasını Supabase SQL Editor'de çalıştırın."
    );
  }
  return message;
}

/* -------------------------------------------------------------------------- */
/*  Baglanti testi                                                            */
/* -------------------------------------------------------------------------- */

export interface AiTestResult {
  provider: AiProvider;
  model: string;
  /** Modelin dondurdugu kisa dogrulama metni. */
  reply: string;
}

/**
 * Girilen ayarlarla GERCEK bir model cagrisi yapar.
 *
 * `generateText` degil `generateObject` kullaniliyor - bilincli bir secim:
 * uygulama soruyu ve puani her zaman JSON SEMASI zorlayarak istiyor. Sadece
 * duz metin ureten bir test, sema desteklemeyen bir modelde de "başarılı"
 * derdi ve yonetici hatayi ancak ilk soru uretiminde gorurdu. Bu test,
 * anahtari + modeli + sema destegini tek seferde dogrular.
 *
 * Anahtar bos gonderilirse KAYITLI ayar test edilir; boylece "kaydettim,
 * gercekten calisiyor mu" sorusu anahtari yeniden yazmadan yanitlanir.
 */
export async function testAiConnection(
  input: AiSettingsInput,
): Promise<ActionResult<AiTestResult>> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, error: denied };

  const checked = validate(input);
  if (!checked.ok) return checked;

  const config = await buildTestConfig(checked.data);
  if (!config.ok) return config;

  try {
    const { object } = await generateObject({
      model: createAiModel(config.data, config.data.modelGeneration),
      maxRetries: 0,
      schema: z.object({
        durum: z.string().describe("Yalnizca 'hazir' yaz."),
      }),
      prompt:
        "Bu bir baglanti testidir. durum alanina yalnizca 'hazir' yazarak yanit ver.",
    });

    return {
      ok: true,
      data: {
        provider: config.data.provider,
        model: config.data.modelGeneration,
        reply: object.durum.slice(0, 40),
      },
    };
  } catch (caught) {
    return { ok: false, error: describeAiError(caught) };
  }
}

/**
 * Test icin kullanilacak yapilandirma.
 *
 * Formda anahtar yazilmissa O test edilir (henuz kaydedilmemis olsa bile -
 * "once kaydet sonra test et" dongusu yanlis anahtari kalici hale getirirdi).
 * Yazilmamissa kayitli ayara dusulur.
 */
async function buildTestConfig(
  input: CleanInput,
): Promise<ActionResult<AiRuntimeConfig>> {
  const info = providerInfo(input.provider);
  const stored = await resolveAiConfig();

  const apiKey = input.apiKey || (stored.source !== "yok" ? stored.apiKey : "");
  if (!looksLikeRealKey(apiKey)) {
    return {
      ok: false,
      error: "Test için önce bir API anahtarı girin.",
    };
  }

  const modelGeneration =
    input.modelGeneration || info.defaultModel || stored.modelGeneration;

  if (!modelGeneration) {
    return { ok: false, error: "Test için bir model adı yazın." };
  }

  return {
    ok: true,
    data: {
      provider: input.provider,
      apiKey,
      baseUrl: input.baseUrl || info.baseUrl,
      modelGeneration,
      modelGrading: input.modelGrading || modelGeneration,
      mockMode: false,
      source: "panel",
    },
  };
}
