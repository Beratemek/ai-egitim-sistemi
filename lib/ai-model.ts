/**
 * Saglayici -> model nesnesi donusumu.
 *
 * Ayri bir dosyada duruyor cunku IKI yerden kullaniliyor: gercek yapay zeka
 * cagrilari (lib/ai.ts) ve ayar ekranindaki "Bağlantıyı test et" dugmesi
 * (app/actions/ai-settings.ts). Ikisi ayni kodu kullanmazsa test gecer ama
 * gercek cagri baska bir yola girip patlayabilir - yani test hicbir sey
 * kanitlamaz.
 *
 * Yalnizca sunucu tarafinda calistirilmalidir; ham API anahtari alir.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

import type { AiRuntimeConfig } from "@/lib/ai-settings";
import { publicEnv } from "@/lib/env";

/**
 * Istenen modeli secilen saglayicidan dondurur.
 *
 * Uc SDK, bes saglayici:
 *   - google     -> Gemini
 *   - anthropic  -> Claude
 *   - openai / openrouter / diger -> hepsi OpenAI arayuzunu konusur; yalnizca
 *     taban adresleri farklidir (OpenRouter, Groq, yerel LLM...).
 *
 * Ucu de sema zorlamali cikti (structured output) destekler; bu yuzden
 * `generateObject` cagrilari saglayiciya gore degismez. OpenRouter'da bu
 * destek MODELE baglidir - ayar ekrani desteklemeyen modelleri isaretler.
 */
export function createAiModel(
  config: AiRuntimeConfig,
  modelId: string,
): LanguageModelV1 {
  if (config.provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
    return google(modelId);
  }

  if (config.provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    return anthropic(modelId);
  }

  const openai = createOpenAI({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    /*
      OpenRouter kimlik basliklari.

      Zorunlu degil ama gonderilmezse istekler OpenRouter panelinde isimsiz
      gorunur; musteri kendi faturasinda hangi harcamanin bu uygulamadan
      geldigini ayirt edemez.
    */
    ...(config.provider === "openrouter"
      ? {
          headers: {
            "HTTP-Referer": publicEnv.siteUrl,
            "X-Title": "AI Egitim Sistemi",
          },
        }
      : {}),
  });

  return openai(modelId);
}
