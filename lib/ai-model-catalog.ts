/**
 * TANIMLI ANAHTARLARIN ERISEBILDIGI MODELLER.
 *
 * Neden var: sistem yoneticisi panelde bir varsayilan model seciyor, ama icerik
 * uzmani uretim sirasinda baska bir model isteyebiliyor - kisa bir kazanim icin
 * ucuz model, zor bir konu icin guclu model. Model adini elle yazdirmak ise
 * hataya acik: yanlis ad 404 doner ve kullanici sebebini bilmez.
 *
 * COKLU SAGLAYICI: anahtari tanimli HER saglayiciya kendi model listesi ucundan
 * soruluyor ve sonuclar gruplanarak tek listede donuyor. Boylece hem Gemini hem
 * OpenRouter anahtari varsa icerik uzmani ikisinin modellerini yan yana gorur;
 * sectigi modelin saglayicisi kayitla birlikte tasindigi icin dogru anahtar
 * kendiliginden kullanilir.
 *
 * Listede yalnizca o anahtarin GERCEKTEN erisebildigi modeller cikar; hesabin
 * acik olmadigi bir model hic gorunmez.
 *
 * Bir saglayici cevap vermezse digerleri yine listelenir - tek bir servisin
 * arizasi butun ekrani calismaz hale getirmemeli.
 *
 * Yalnizca sunucu tarafinda calistirilmalidir; ham anahtar kullanir.
 */

import { cache } from "react";

import { providerInfo, type AiProvider } from "@/lib/ai-providers";
import {
  configuredProviders,
  resolveAiConfig,
  resolveAiConfigFor,
  type AiRuntimeConfig,
} from "@/lib/ai-settings";
import {
  fetchOpenRouterModels,
  formatUsd,
  questionCost,
  type OpenRouterModel,
} from "@/lib/openrouter-models";

/** Bir saglayici bekletirse sayfa da bekler; kisa tutuyoruz. */
const TIMEOUT_MS = 4000;

/** Model listesi sunucu onbelleginde bu kadar saniye tutulur. */
const CACHE_SECONDS = 600;

/**
 * Saglayici basina listeye alinan model sayisi.
 *
 * Yuksek tutuluyor cunku OpenRouter'in varlik sebebi YUZLERCE modele tek
 * anahtarla erisebilmek; 40'a kirpmak o listenin buyuk kismini gizlerdi.
 * Secim kutusunda arama oldugu icin uzun liste sorun degil.
 */
const MAX_OPTIONS = 300;

/**
 * Liste sunucu belleginde 10 dakika tutulur.
 *
 * Neden Next'in `fetch` onbellegi ya da `unstable_cache` degil: ikisi de
 * istegi/argumanlari onbellek ANAHTARINA yaziyor ve bu cagrilarin icinde API
 * anahtari var - anahtarin diske dusmesini istemiyoruz. Surec belleginde tutmak
 * hem anahtari disari cikarmiyor hem de icerik uzmani sayfasinin her acilista
 * saglayicilara gitmesini onluyor.
 *
 * Anahtar degisirse parmak izi degisir ve kayit kendiliginden gecersizlesir.
 */
const TTL_MS = 10 * 60 * 1000;

const memo = new Map<string, { at: number; models: AvailableModel[] }>();

/** Onbellek anahtari - ham API anahtarini ICERMEZ. */
function memoKey(config: AiRuntimeConfig): string {
  return `${config.provider}|${config.baseUrl}|${config.apiKey.slice(-6)}`;
}

export interface AvailableModel {
  /** Modelin ait oldugu saglayici - uretimde bu saglayicinin anahtari kullanilir. */
  provider: AiProvider;
  /** Modele verilecek tam kimlik. */
  id: string;
  /** Ekranda gorunen ad. */
  label: string;
  /**
   * 10 soruluk tahmini tutar (USD), hazir bicimlenmis.
   *
   * Fiyat yayinlamayan saglayicilarda OpenRouter listesinden eslenir
   * (bkz. `costFor`); hicbir eslesme yoksa `null` ve fiyat gosterilmez.
   */
  cost: string | null;
  /**
   * Fiyat/performans onerisi mi?
   *
   * Isaretli modeller kendi KATEGORISININ basina aliniyor; bkz. `VALUE_MODELS`.
   */
  recommended: boolean;
}

export interface ModelGroup {
  provider: AiProvider;
  providerLabel: string;
  models: AvailableModel[];
  /** Bu saglayicinin listesi alinamadiysa sebebi. */
  error: string | null;
}

export interface ModelCatalog {
  /** Anahtari tanimli her saglayici icin bir grup. */
  groups: ModelGroup[];
  /** Model secilmezse kullanilacak saglayici ve model. */
  defaultProvider: AiProvider;
  defaultModel: string;
  /** Simulasyon modunda model secimi anlamsizdir. */
  mockMode: boolean;
  /** Hicbir model listelenemediyse tek cumlelik sebep. */
  error: string | null;
}

/**
 * Tanimli anahtarlara gore model listesini dondurur.
 *
 * `cache()` ile sarmali: ayni istekte sayfa birden fazla kez cagirabilir,
 * saglayicilara yalnizca bir kez gidilir.
 */
export const listAvailableModels = cache(async (): Promise<ModelCatalog> => {
  const active = await resolveAiConfig();
  const base: ModelCatalog = {
    groups: [],
    defaultProvider: active.provider,
    defaultModel: active.modelGeneration,
    mockMode: active.mockMode,
    error: null,
  };

  if (active.mockMode) {
    return {
      ...base,
      error:
        "Simülasyon modu açık; model seçimi üretimi etkilemez. Sistem yöneticisi API Anahtarları ekranından simülasyonu kapatmalı.",
    };
  }

  /*
    YALNIZCA anahtari tanimli saglayicilar listelenir.

    OpenRouter'in model/fiyat listesi anahtarsiz da cekilebiliyor ve bir ara
    "fiyatlari gormek icin" anahtarsiz da gosteriliyordu. Kaldirildi:
    secilemeyecek bir modeli listede tutmak, kullaniciyi denemeye davet edip
    sonra durdurmak demekti.
  */
  const providers = await configuredProviders();

  if (providers.length === 0) {
    return {
      ...base,
      error:
        "Tanımlı bir API anahtarı yok. Sistem yöneticisi Sistem > API Anahtarları ekranından anahtar tanımlamalı.",
    };
  }

  const groups = await Promise.all(providers.map(loadGroup));
  const total = groups.reduce((sum, group) => sum + group.models.length, 0);

  return {
    ...base,
    groups,
    error:
      total === 0
        ? (groups.find((group) => group.error)?.error ??
          "Sağlayıcılar kullanılabilir model döndürmedi.")
        : null,
  };
});

/* -------------------------------------------------------------------------- */
/*  Fiyat dizini                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Dogrudan saglayicidan gelen modellerin FIYATI.
 *
 * Sorun: Google, OpenAI ve Anthropic'in model listesi uclari fiyat DONDURMUYOR
 * - yalnizca model adlarini veriyorlar. Oysa "10 soru ne tutar" bilgisi
 * secimin en onemli girdisi ve yalnizca OpenRouter modellerinde gorunuyordu.
 *
 * Cozum: fiyati OpenRouter'in HERKESE ACIK liste fiyatlarindan esliyoruz.
 * OpenRouter zaten ayni modelleri (`openai/gpt-4o-mini`, `google/gemini-...`,
 * `anthropic/claude-...`) yayin fiyatlariyla listeliyor ve o liste bu ekranda
 * halihazirda cekiliyor - yani ek bir istek maliyeti yok.
 *
 * Neden sabit bir fiyat tablosu yazmadik: elle yazilan tablo birkac ay icinde
 * sessizce yanlis olur ve yoneticiye yanlis karar verdirir. Bu yol canli
 * kalir.
 *
 * Eslesmeyen model icin fiyat GOSTERILMEZ - uydurmak yerine bos birakiyoruz.
 */
const OPENROUTER_VENDOR: Partial<Record<AiProvider, string>> = {
  google: "google",
  openai: "openai",
  anthropic: "anthropic",
};

/**
 * Ad normalizasyonu.
 *
 * Iki taraf ayni modeli farkli yaziyor: Anthropic "claude-haiku-4-5-20251001",
 * OpenRouter "anthropic/claude-haiku-4.5". Sondaki tarih damgasi atiliyor ve
 * noktalar tireye ceviriliyor ki ikisi ayni anahtara dussun.
 */
function normalizeModelId(id: string): string {
  return id
    .toLocaleLowerCase("en")
    .replace(/-\d{8}$/, "")
    .replace(/\./g, "-");
}

/** OpenRouter listesinden ad -> model dizini. */
const priceIndex = cache(async (): Promise<Map<string, OpenRouterModel>> => {
  const catalog = await fetchOpenRouterModels();
  const index = new Map<string, OpenRouterModel>();

  for (const model of catalog.models) {
    const full = normalizeModelId(model.id);
    if (!index.has(full)) index.set(full, model);

    // "google/gemini-3.6-flash" -> "gemini-3.6-flash"
    const bare = full.split("/").slice(1).join("/");
    if (bare && !index.has(bare)) index.set(bare, model);
  }

  return index;
});

/** Modelin OpenRouter karsiligi; bulunamazsa `null`. */
function matchOpenRouter(
  index: Map<string, OpenRouterModel>,
  provider: AiProvider,
  modelId: string,
): OpenRouterModel | null {
  const key = normalizeModelId(modelId);
  const vendor = OPENROUTER_VENDOR[provider];

  return (
    (vendor ? index.get(`${vendor}/${key}`) : undefined) ??
    index.get(key) ??
    null
  );
}

/**
 * Uygulamayla uyumsuz oldugu KANITLI mi?
 *
 * Uygulama soruyu `generateObject` ile, yani JSON semasi zorlayarak uretiyor.
 * OpenRouter her model icin bu destegi yayinliyor; karsiligini bulabildigimiz
 * ve "desteklemiyor" dedigi modelleri listeye HIC almiyoruz - secilseler her
 * uretim hatayla biterdi.
 *
 * Karsiligi bulunamayan model elenmez: cogunlukla yeni cikmis, OpenRouter'in
 * henuz tasimadigi surumler oluyor ve bunlar genelde en iyi modeller.
 * "Kanit yok" ile "uyumsuz" ayni sey degil.
 */
function knownIncompatible(hit: OpenRouterModel | null): boolean {
  return hit !== null && !hit.structuredOutput;
}

/** Eslesen modelin 10 soruluk tutari. */
function costOf(hit: OpenRouterModel | null): string | null {
  return hit ? formatUsd(questionCost(hit, 10)) : null;
}

/* -------------------------------------------------------------------------- */
/*  Fiyat/performans onerileri                                                */
/* -------------------------------------------------------------------------- */

/**
 * Listenin basina alinacak modeller.
 *
 * NEDEN SADECE UCUZLUGA BAKMIYORUZ: en ucuz modeller cogu zaman Turkce sinav
 * sorusunu ve zorunlu JSON semasini beceremiyor. O modelle uretilen soru ya
 * hic gelmiyor ya da elde duzeltilecek kadar kotu geliyor - yani "ucuz" secim
 * sonucta daha pahaliya mal oluyor. Buradaki liste "isi goren en ucuz siniftan"
 * modelleri one aliyor, sonuna da bilincli olarak bir kalite ucu ekliyor.
 *
 * TAM AD DEGIL DESEN eslesmesi kullaniliyor: saglayicilar surum adlarini sik
 * degistiriyor (gemini-2.5-flash -> gemini-3.6-flash). Tam ad yazsaydik liste
 * birkac ay icinde sessizce bosalirdi. Eslesme model KIMLIGI uzerinde yapilir,
 * yani hangi saglayicidan geldigi fark etmez - ayni model OpenRouter uzerinden
 * de gelse yakalanir.
 *
 * SIRA = gosterim sirasi: ustte gunluk is icin en dengeli olan durur.
 */
const VALUE_MODELS: readonly RegExp[] = [
  /gemini-[\d.]+-flash(-latest)?$/i,
  /gpt-4o-mini$/i,
  /gpt-4\.1-mini$/i,
  /deepseek(-chat|-v3)/i,
  /claude-haiku/i,
  /llama-3\.3-70b/i,
  /claude-sonnet/i,
];

/**
 * Onerileri isaretler ve KENDI KATEGORISININ basina alir.
 *
 * Ayri bir "one cikanlar" blogu denenmisti; kategorileri kopyaladigi ve ayni
 * model iki yerde birden gorundugu icin kaldirildi. Model, ait oldugu
 * saglayicinin altinda ve o listenin en ustunde duruyor - hem kategorik yapi
 * bozulmuyor hem de kullanici aramak zorunda kalmiyor.
 *
 * Siralama VALUE_MODELS sirasini korur: ustte gunluk is icin en dengeli olan.
 * Isaretlenmeyenlerin kendi arasindaki sirasi degismez (saglayicidan geldigi
 * gibi; OpenRouter'da ucuzdan pahaliya).
 */
function markRecommended(models: AvailableModel[]): AvailableModel[] {
  const rank = (model: AvailableModel): number => {
    const index = VALUE_MODELS.findIndex((pattern) => pattern.test(model.id));
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };

  return models
    .map((model) => ({ ...model, recommended: rank(model) !== Number.POSITIVE_INFINITY }))
    .sort((a, b) => rank(a) - rank(b));
}

/** Tek bir saglayicinin grubu. Hata FIRLATMAZ; sebebi gruba yazar. */
async function loadGroup(provider: AiProvider): Promise<ModelGroup> {
  const info = providerInfo(provider);
  const group: ModelGroup = {
    provider,
    providerLabel: info.label,
    models: [],
    error: null,
  };

  const config = await resolveAiConfigFor(provider);
  if (!config) {
    return { ...group, error: `${info.label} için kayıtlı anahtar yok.` };
  }

  try {
    const key = memoKey(config);
    const hit = memo.get(key);

    if (hit && Date.now() - hit.at < TTL_MS) {
      return { ...group, models: hit.models };
    }

    const models = markRecommended(await fetchModels(config));
    memo.set(key, { at: Date.now(), models });

    return { ...group, models };
  } catch (caught) {
    return {
      ...group,
      error:
        caught instanceof Error
          ? `${info.label} model listesi alınamadı: ${caught.message}`
          : `${info.label} model listesi alınamadı.`,
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Saglayiciya gore listeleme                                                */
/* -------------------------------------------------------------------------- */

async function fetchModels(config: AiRuntimeConfig): Promise<AvailableModel[]> {
  if (config.provider === "openrouter") return openRouterModels();

  // Diger saglayicilar fiyat dondurmuyor; OpenRouter listesinden esliyoruz.
  const prices = await priceIndex();

  switch (config.provider) {
    case "anthropic":
      return anthropicModels(config, prices);
    case "google":
      return googleModels(config, prices);
    default:
      return openAiModels(config, prices);
  }
}

/** Ortak GET: zaman asimi + HTTP hatasini okunabilir mesaja cevirme. */
async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<unknown> {
  /*
    Onbellek AGDAN once gelir.

    Onceden `cache: "no-store"` yaziyordu ve surec bellegindeki memo'ya
    guveniliyordu. Vercel'de bu ise yaramiyor: her soguk baslangic yeni bir
    surec demek, yani icerik uzmani sayfasi cogu acilista saglayicilara
    gercekten gidiyordu - sayfa iki dis HTTP cagrisini bekliyordu.

    `revalidate` ile liste sunucu tarafinda 10 dakika tutuluyor. Anahtar
    yalnizca istegin kendisinde; onbellek sunucuda kaliyor, tarayiciya hicbir
    sey gitmiyor.
  */
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "anahtar geçersiz ya da yetkisiz"
        : `HTTP ${response.status}`,
    );
  }

  return response.json();
}

/** Yanittaki dizi alanini guvenle cikarir. */
function rows(payload: unknown, field: string): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>)[field];
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/**
 * OpenRouter: fiyat listesi zaten cekiliyor, tekrar sormuyoruz.
 *
 * Yalnizca JSON SEMA destekleyen modeller listeleniyor. Sebep: soru uretimi
 * `generateObject` ile yapiliyor; desteklemeyen bir model secilirse uretim her
 * denemede hata verir. Icerik uzmanina calismayacak bir secenek sunmamak, sonra
 * hatayi aciklamaktan iyidir.
 */
async function openRouterModels(): Promise<AvailableModel[]> {
  const catalog = await fetchOpenRouterModels();
  if (catalog.error) throw new Error(catalog.error);

  return catalog.models
    .filter((model) => model.structuredOutput)
    .slice(0, MAX_OPTIONS)
    .map((model) => ({
      provider: "openrouter" as const,
      id: model.id,
      label: model.label,
      cost: formatUsd(questionCost(model, 10)),
      recommended: false,
    }));
}

/** Anthropic: `GET /v1/models`, surum basligi zorunlu. */
async function anthropicModels(
  config: AiRuntimeConfig,
  prices: Map<string, OpenRouterModel>,
): Promise<AvailableModel[]> {
  const payload = await getJson(
    `${config.baseUrl || "https://api.anthropic.com"}/v1/models?limit=100`,
    {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
  );

  return rows(payload, "data")
    .map((row) => {
      const id = typeof row.id === "string" ? row.id : "";
      const hit = id ? matchOpenRouter(prices, "anthropic", id) : null;

      return {
        id,
        hit,
        label:
          typeof row.display_name === "string" && row.display_name
            ? row.display_name
            : id,
      };
    })
    .filter(
      (entry) =>
        entry.id && !NON_CHAT.test(entry.id) && !knownIncompatible(entry.hit),
    )
    .map((entry) => ({
      provider: "anthropic" as const,
      id: entry.id,
      label: entry.label,
      cost: costOf(entry.hit),
      recommended: false,
    }))
    .slice(0, MAX_OPTIONS);
}

/**
 * Google: `GET /v1beta/models?key=...`
 *
 * Liste gomme (embedding) ve resim modellerini de icerir; yalnizca
 * `generateContent` destekleyenler metin uretebilir.
 */
async function googleModels(
  config: AiRuntimeConfig,
  prices: Map<string, OpenRouterModel>,
): Promise<AvailableModel[]> {
  const payload = await getJson(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(config.apiKey)}&pageSize=200`,
    {},
  );

  return rows(payload, "models")
    .filter((row) => {
      const methods = row.supportedGenerationMethods;
      if (!Array.isArray(methods) || !methods.includes("generateContent")) {
        return false;
      }
      // "gemini-3.5-transcribe", "lyria-3-clip-preview" gibi metin uretmeyen
      // modeller de generateContent destekliyor; adindan eliyoruz.
      return typeof row.name === "string" && !NON_CHAT.test(row.name);
    })
    .map((row) => {
      // "models/gemini-3.6-flash" -> "gemini-3.6-flash"
      const id = typeof row.name === "string" ? row.name.replace(/^models\//, "") : "";

      return {
        id,
        hit: id ? matchOpenRouter(prices, "google", id) : null,
        label:
          typeof row.displayName === "string" && row.displayName
            ? row.displayName
            : id,
      };
    })
    .filter((entry) => entry.id && !knownIncompatible(entry.hit))
    .map((entry) => ({
      provider: "google" as const,
      id: entry.id,
      label: entry.label,
      cost: costOf(entry.hit),
      recommended: false,
    }))
    .slice(0, MAX_OPTIONS);
}

/**
 * OpenAI ve OpenAI uyumlu servisler: `GET {taban}/models`.
 *
 * OpenAI listesi ses, gorsel ve gomme modellerini de dondurur; bunlar soru
 * uretemez. Bilinen SOHBET DISI onekleri eliyoruz. "Diger" saglayicilarda ad
 * duzeni bilinmedigi icin ayni eleme uygulanir ama liste bosalirsa ham liste
 * geri verilir - yanlis bir filtre yuzunden hicbir secenek gosterememektense
 * fazlasini gostermek yeglenir.
 */
/**
 * SORU URETEMEYEN modeller.
 *
 * Saglayicilarin model listesi yalnizca sohbet modellerini dondurmuyor: ses
 * yazima ("transcribe"), muzik ("lyria"), video ("veo"), gorsel ("imagen",
 * "-image"), gomme ("embedding") ve gercek zamanli ses ("live") modelleri de
 * ayni listede geliyor. Google'in ucunda bunlarin bir kismi
 * `generateContent` bile destekliyor, yani yetenek alanina bakarak ayiklamak
 * yetmiyor - ad uzerinden elemek gerekiyor.
 *
 * Listede birakilsalar secilebilir olurlardi ve secen kisi ya hata alirdi ya
 * da soru yerine anlamsiz cikti.
 */
const NON_CHAT =
  /(embed|whisper|tts|audio|dall-e|imagen|image|lyria|veo|music|moderation|realtime|live|transcribe|search|rerank|guard|aqa)/i;

async function openAiModels(
  config: AiRuntimeConfig,
  prices: Map<string, OpenRouterModel>,
): Promise<AvailableModel[]> {
  const base = (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  const payload = await getJson(`${base}/models`, {
    Authorization: `Bearer ${config.apiKey}`,
  });

  const all = rows(payload, "data")
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "en"));

  const chat = all.filter((id) => !NON_CHAT.test(id));

  return (chat.length > 0 ? chat : all)
    .map((id) => ({ id, hit: matchOpenRouter(prices, config.provider, id) }))
    .filter((entry) => !knownIncompatible(entry.hit))
    .slice(0, MAX_OPTIONS)
    .map((entry) => ({
      provider: config.provider,
      id: entry.id,
      label: entry.id,
      cost: costOf(entry.hit),
      recommended: false,
    }));
}
