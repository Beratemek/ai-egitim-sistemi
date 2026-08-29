/**
 * OpenRouter model listesi ve MALIYET TAHMINI.
 *
 * Neden var: OpenRouter tek anahtarla yuzlerce modele kapi aciyor ve aradaki
 * fiyat farki 100 kata kadar cikabiliyor. Sistem yoneticisi model adini elle
 * yazdiginda "bu secim ayda ne tutar" sorusunun cevabi hicbir yerde gorunmuyor;
 * ucuz bir modelle pahali bir modeli ayirt etmenin yolu yok.
 *
 * Fiyatlar SABIT YAZILMAZ - OpenRouter'in kendi listesinden CANLI cekilir
 * (`/api/v1/models`, anahtar gerektirmez, saatlik onbelleklenir). Sabit
 * yazilan bir fiyat tablosu birkac ay icinde sessizce yanlis olur ve
 * yoneticiye yanlis karar verdirir.
 *
 * Bu modul yalnizca SUNUCUDA calisir; ciktisi (fiyatlar, model adlari) gizli
 * olmadigi icin arayuze oldugu gibi verilebilir.
 */

const MODELS_URL = "https://openrouter.ai/api/v1/models";

/** Liste saatte bir tazelenir; fiyatlar gun icinde nadiren degisir. */
const CACHE_SECONDS = 3600;

/** Arayuze tasinan model sayisi ust siniri (istemci paketi sismesin). */
const MAX_MODELS = 260;

/* -------------------------------------------------------------------------- */
/*  Maliyet varsayimlari                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Bir islemin modele kac jeton maliyeti oldugu.
 *
 * Olculen degil TAHMIN edilen degerlerdir; uygulamanin gercek istemlerine
 * (sistem talimati + kaynak metin payi + JSON sema ciktisi) gore secildi.
 * Arayuz bu varsayimi kullaniciya ACIKCA yazar - "kesin fatura" gibi
 * gosterilirse yanlis guven verir.
 *
 * Kaynak metin uzunlugu en oynak kalem: uzun bir PDF yuklenirse giris jetonu
 * buradaki degerin katlarina cikabilir. Bu yuzden rakam "yaklasik" diye
 * sunulur ve karsilastirma amaclidir - modeller arasi SIRALAMA dogrudur.
 */
export const COST_BASIS = {
  /** Soru uretimi: kazanim + kaynak metin payi + sema talimati. */
  generationInputTokens: 1200,
  /** Uretilen soru: govde, siklar, rubrik/gorsel JSON. */
  generationOutputTokens: 500,
  /** Puanlama: ogrenci cevabi + rubrik. */
  gradingInputTokens: 700,
  /** Puanlama ciktisi: puan, gerekce, kriter listesi. */
  gradingOutputTokens: 250,
} as const;

export interface OpenRouterModel {
  /** `openai/gpt-4o-mini` bicimindeki tam kimlik - modele bu ad verilir. */
  id: string;
  /** Insan okur ad: "OpenAI: GPT-4o-mini". */
  label: string;
  /** Modeli saglayan firma (kimligin ilk parcasi). */
  vendor: string;
  /** 1 giris jetonunun USD fiyati. */
  inputPrice: number;
  /** 1 cikis jetonunun USD fiyati. */
  outputPrice: number;
  /** Baglam penceresi (jeton). */
  contextLength: number;
  /**
   * Sema zorlamali cikti destegi.
   *
   * KRITIK: uygulama soru uretirken `generateObject` kullaniyor, yani modelin
   * verilen JSON semasina uymasi gerekiyor. Desteklemeyen bir model secilirse
   * soru uretimi her denemede hata verir. Arayuz varsayilan olarak yalnizca
   * destekleyen modelleri gosterir.
   */
  structuredOutput: boolean;
  /** Fiyati sifir olan (ucretsiz katman) modeller. */
  free: boolean;
}

export interface OpenRouterCatalog {
  models: readonly OpenRouterModel[];
  /** Liste alinamadiysa kullaniciya gosterilecek sebep. */
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Cekme                                                                     */
/* -------------------------------------------------------------------------- */

/** OpenRouter yanitindaki tek modelin ham bicimi. */
interface RawModel {
  id?: unknown;
  name?: unknown;
  context_length?: unknown;
  pricing?: { prompt?: unknown; completion?: unknown } | null;
  supported_parameters?: unknown;
}

/** Fiyatlar dizge olarak gelir ("0.00000015"); sayiya cevirir. */
function toPrice(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : Number(value ?? NaN);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function normalize(raw: RawModel): OpenRouterModel | null {
  if (typeof raw.id !== "string" || !raw.id) return null;

  const inputPrice = toPrice(raw.pricing?.prompt);
  const outputPrice = toPrice(raw.pricing?.completion);

  // Fiyati okunamayan modeli listeye almiyoruz: maliyet sutunu bos kalir ve
  // ekranin tek varlik sebebi maliyet karsilastirmasi.
  if (!Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) return null;

  const parameters = Array.isArray(raw.supported_parameters)
    ? raw.supported_parameters.filter(
        (item): item is string => typeof item === "string",
      )
    : [];

  const contextLength =
    typeof raw.context_length === "number" && raw.context_length > 0
      ? raw.context_length
      : 0;

  return {
    id: raw.id,
    label: typeof raw.name === "string" && raw.name ? raw.name : raw.id,
    vendor: raw.id.split("/")[0] ?? "",
    inputPrice,
    outputPrice,
    contextLength,
    structuredOutput:
      parameters.includes("structured_outputs") ||
      parameters.includes("response_format"),
    free: inputPrice === 0 && outputPrice === 0,
  };
}

/**
 * Model listesini fiyatlariyla birlikte dondurur.
 *
 * Hicbir kosulda FIRLATMAZ: liste alinamazsa ayar ekrani yine acilmali,
 * yonetici model adini elle yazip kaydedebilmeli. Hata yalnizca mesaj olarak
 * doner.
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterCatalog> {
  try {
    const response = await fetch(MODELS_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: CACHE_SECONDS },
    });

    if (!response.ok) {
      return {
        models: [],
        error: `OpenRouter model listesi alınamadı (HTTP ${response.status}).`,
      };
    }

    const payload: unknown = await response.json();
    const rows =
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: RawModel[] }).data
        : [];

    const models = rows
      .map(normalize)
      .filter((model): model is OpenRouterModel => model !== null)
      .sort(compareModels)
      .slice(0, MAX_MODELS);

    if (models.length === 0) {
      return { models: [], error: "OpenRouter model listesi boş döndü." };
    }

    return { models, error: null };
  } catch {
    return {
      models: [],
      error:
        "OpenRouter'a ulaşılamadı. Model adını elle yazabilirsiniz; fiyat tahmini gösterilmez.",
    };
  }
}

/**
 * Siralama: once sema destegi olanlar (uygulamanin calisabildigi modeller),
 * sonra ucuzdan pahaliya. Ucretsiz modeller ayri bir gruba alinmaz, kendi
 * fiyat sirasina (0) girer.
 */
function compareModels(a: OpenRouterModel, b: OpenRouterModel): number {
  if (a.structuredOutput !== b.structuredOutput) return a.structuredOutput ? -1 : 1;
  return questionCost(a, 1) - questionCost(b, 1);
}

/* -------------------------------------------------------------------------- */
/*  Maliyet hesabi                                                            */
/* -------------------------------------------------------------------------- */

/** Verilen sayida SORU URETIMININ tahmini USD maliyeti. */
export function questionCost(model: OpenRouterModel, questions: number): number {
  return (
    questions *
    (COST_BASIS.generationInputTokens * model.inputPrice +
      COST_BASIS.generationOutputTokens * model.outputPrice)
  );
}

/** Verilen sayida CEVAP PUANLAMASININ tahmini USD maliyeti. */
export function gradingCost(model: OpenRouterModel, answers: number): number {
  return (
    answers *
    (COST_BASIS.gradingInputTokens * model.inputPrice +
      COST_BASIS.gradingOutputTokens * model.outputPrice)
  );
}

/**
 * Kucuk tutarlari anlamli basamakla yazar.
 *
 * 10 sorunun maliyeti cogu modelde bir kurusun altinda kalir; iki basamakla
 * yazilirsa hepsi "$0.00" gorunur ve ekran hicbir sey anlatmaz.
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

/** "128K" gibi kisa baglam etiketi. */
export function formatContext(tokens: number): string {
  if (tokens <= 0) return "—";
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

/**
 * Fiyat sinifi: ucretsiz / ucuz / orta / pahali.
 *
 * Esikler 100 SORU uzerinden: 10 sentin altini "ucuz", 1 dolarin ustunu
 * "pahali" sayiyoruz. Amac kesin bir siniflandirma degil, listede gozle
 * taranabilir bir isaret vermek.
 */
export type CostTier = "ucretsiz" | "ucuz" | "orta" | "pahali";

export function costTier(model: OpenRouterModel): CostTier {
  if (model.free) return "ucretsiz";
  const hundred = questionCost(model, 100);
  if (hundred < 0.1) return "ucuz";
  if (hundred < 1) return "orta";
  return "pahali";
}
