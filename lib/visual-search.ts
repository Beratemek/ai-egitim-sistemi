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

import { atifGerekli, parseVisual, type ImageVisual } from "@/lib/visual";

/** Commons API adresi. `origin=*` CORS icin degil, anonim erisim icin. */
const COMMONS = "https://commons.wikimedia.org/w/api.php";

/** Kucuk resim genisligi (px). Tam boy dosyalar 10+ MB olabiliyor. */
const THUMB_WIDTH = 800;

/**
 * Aramadan kac aday istenir - istenen sonuc sayisinin bu kati kadar.
 *
 * Adaylarin buyuk cogunlugu lisans elemesinden geciyor (asagiya bakin);
 * `limit` kadar istenirse geriye bir avuc sonuc kaliyordu. Ust sinir
 * Commons'in `gsrlimit` tavani.
 */
const ADAY_KATI = 5;
const ADAY_TAVANI = 50;

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
    gsrlimit: String(Math.min(limit * ADAY_KATI, ADAY_TAVANI)),
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

    /*
      BASARISIZLIK SESSIZ KALMASIN.

      Bos dizi donmek dogru davranis - bir aglantı hatasi butun soru
      uretimini dusurmemeli. Ama bu, TESHISI de imkansiz kiliyordu: hiz
      sinirina takilmak, sonuc bulunamamak ve servisin cokmesi disaridan
      birebir ayni goruntuyu veriyordu ("gorsel yok").

      Wikimedia arka arkaya gelen istekleri gercekten kisitliyor (HTTP 429
      ya da duz metin "You are making too many requests") ve bir seferde on
      soru ureten bir istek tam olarak bunu tetikliyor. Kayit dusmezse bu
      durum "model gorsel istemedi" sanilir.
    */
    if (!response.ok) {
      console.warn(
        `[visual-search] Commons yanit vermedi (HTTP ${response.status})` +
          (response.status === 429 ? " - hiz siniri" : "") +
          `; sorgu: "${trimmed}"`,
      );
      return [];
    }
    payload = (await response.json()) as typeof payload;
  } catch (caught) {
    // JSON cozulemediyse Commons duz metin hata dondurmus olabilir
    // (hiz sinirinda boyle yapiyor).
    console.warn(
      `[visual-search] Commons sorgusu basarisiz; sorgu: "${trimmed}"`,
      caught instanceof Error ? caught.message : caught,
    );
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
    .filter((item): item is ImageVisual => item !== null)
    /*
      LISANS ELEMESI - yalnizca ATIF ISTEMEYEN gorseller.

      Istek acikti: sorunun altinda kaynak/lisans satiri gorunmesin. Bir CC
      BY-SA gorselinin altyazisini silmek telif ihlali oldugu icin bu istek
      GORSELI SECERKEN karsilaniyor: kamu mali ve CC0 disina cikilmiyor,
      dolayisiyla gosterilecek bir atif hic olusmuyor.

      BEDELI ACIK OLSUN: aday havuzu daralir. Klasik eserler, haritalar, eski
      fotograflar, bilimsel semalar cogunlukla kamu malidir ve gelmeye devam
      eder; buna karsilik gunumuzde cekilmis fotograflarin cogu CC BY-SA'dir
      ve artik SECILMEZ. Hicbir serbest gorsel bulunamazsa sonuc bos doner ve
      soru gorselsiz uretilir - yanlis lisansli bir gorsel koymaktansa
      gorselsiz birakmak dogru.

      NOT: bu kural yalnizca YENI aramalar icin. Havuzda bu kuraldan once
      kaydedilmis CC lisansli gorseller var; onlarin altyazisi hukuken
      gerekli oldugu icin cizilmeye devam eder (question-visual.tsx).
    */
    .filter((item) => !atifGerekli(item.license))
    .slice(0, limit);
}
