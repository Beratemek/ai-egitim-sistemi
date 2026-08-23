/**
 * Wikimedia Commons gorsel aramasi - sunucu tarafi paylasilan cekirdek.
 *
 * IKI CAGIRAN VAR:
 *   - app/api/visual-search/route.ts  icerik uzmani elle arama yapar
 *   - lib/ai.ts                       model REFERANS turu gorsel istediginde
 *                                      otomatik arama yapar (bkz. asagidaki
 *                                      "referans vs. chart/svg" ayrimi)
 *
 * NEDEN WIKIMEDIA, GOOGLE DEGIL:
 *   - Anahtar istemiyor. Google Custom Search API anahtar + gunluk 100 sorgu
 *     siniri demek; projede kota derdi zaten var.
 *   - Lisans bilgisi API'den geliyor. Egitim materyaline gorsel koyarken
 *     kaynak ve lisans gostermek zorunlu; Google sonuclari bunu vermiyor.
 *   - Sonuclar kuratorlu: Commons'ta rastgele web gorseli bulunmuyor.
 *
 * REFERANS ile CHART/SVG arasindaki fark (bkz. lib/ai.ts VISUAL_INSTRUCTIONS):
 * bu fonksiyon SORUNUN CEVABINA ETKI ETMEYEN, sadece gercek bir varligi/eseri
 * gosteren gorseller icindir (or. "Mona Lisa tablosu"). Cevabi belirleyen
 * SAYI ya da OLCU tasiyan gorseller (grafik, geometri) buradan GELMEZ - onlar
 * modelin kendisi tarafindan uretilir, cunku Wikimedia'dan gelen bir
 * fotografin sayilari sorunun beklentisiyle asla garanti uyusmaz.
 */

import { parseVisual, type ImageVisual } from "@/lib/visual";

/** Commons API adresi. `origin=*` CORS icin degil, anonim erisim icin. */
const COMMONS = "https://commons.wikimedia.org/w/api.php";

/** Kucuk resim genisligi (px). Tam boy dosyalar 10+ MB olabiliyor. */
const THUMB_WIDTH = 800;

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

/** HTML etiketlerini soker: Commons alan degerleri HTML olarak geliyor. */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Wikimedia Commons'ta bitmap dosya arar.
 *
 * Sorgu 2 karakterden kisaysa (bos aramayi onlemek icin) ya da servis
 * cevap vermezse bos dizi doner - ISTISNA FIRLATMAZ. Cagiranlardan biri
 * (lib/ai.ts) bunu bir soru uretiminin ortasinda cagiriyor; bir aglantı
 * hatasinin butun uretimi dusurmesi yanlis olurdu.
 */
export async function searchWikimediaImages(
  query: string,
  limit = 12,
): Promise<ImageVisual[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  /*
    Tek istekte hem arama hem dosya bilgisi:
    generator=search  -> arama sonuclarini sayfa listesine cevirir
    prop=imageinfo    -> her sayfa icin URL, kucuk resim ve lisans meta verisi

    Iki ayri cagri yapmak (once arama, sonra her sonuc icin bilgi) uzak
    servise N+1 istek demekti.
  */
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `filetype:bitmap ${trimmed}`,
    gsrnamespace: "6", // yalnizca File: ad alani
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(THUMB_WIDTH),
  });

  let payload: { query?: { pages?: Record<string, CommonsPage> } };

  try {
    const response = await fetch(`${COMMONS}?${params}`, {
      headers: {
        // Wikimedia kimlik gonderilmeyen istemcileri kisitliyor.
        "User-Agent": "AI-Egitim-Sistemi/1.0 (egitim projesi)",
      },
      // Ayni arama tekrar edilirse Next onbellegi kullanilir.
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    payload = (await response.json()) as typeof payload;
  } catch {
    return [];
  }

  const pages = Object.values(payload.query?.pages ?? {});

  return pages
    .map((page): ImageVisual | null => {
      const info = page.imageinfo?.[0];
      if (!info) return null;

      const meta = info.extmetadata ?? {};
      const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : "";
      const license = meta.LicenseShortName?.value
        ? stripHtml(meta.LicenseShortName.value)
        : "";

      // Baslikta "File:" oneki ve uzanti var; ekran okuyucu metni icin
      // temizleniyor.
      const alt = (page.title ?? "")
        .replace(/^File:/i, "")
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/_/g, " ");

      const parsed = parseVisual({
        kind: "image",
        url: info.thumburl ?? info.url ?? "",
        alt,
        credit: artist || "Wikimedia Commons",
        license: license || "Wikimedia Commons lisansı",
        ...(info.descriptionurl ? { sourceUrl: info.descriptionurl } : {}),
      });

      return parsed?.kind === "image" ? parsed : null;
    })
    .filter((item): item is ImageVisual => item !== null);
}
