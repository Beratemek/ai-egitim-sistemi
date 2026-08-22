/**
 * Soru gorselleri: grafik, sema ve fotograf.
 *
 * UC BICIM VAR ve hicbirinde AI'a resim CIZDIRILMIYOR:
 *
 *   chart : Model veriyi JSON olarak yazar, recharts cizer. Sayilar modelden,
 *           cizim koddan gelir - yanlis cizim mumkun degil.
 *   svg   : Model vektor cizim yazar (ucgen, devre, hucre semasi). Yine
 *           deterministik: kod ne yazdiysa o gorunur.
 *   image : Dis kaynaktan (Wikimedia Commons) gelen fotograf + lisans.
 *
 * NEDEN URETIM DEGIL: uretilen bir resim SESSIZCE yanlis olabilir. "Kenarlari
 * 3-4-5 olan ucgen" deyip 3-4-6 cizen bir model soruyu bozar ve kimse fark
 * etmez. Grafikte model "3, 4, 5" yazar; ucgeni kod cizer.
 */

/* -------------------------------------------------------------------------- */
/*  Tipler                                                                    */
/* -------------------------------------------------------------------------- */

export const CHART_TYPES = ["bar", "line", "pie"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Grafik gorseli. `data` satirlari `xKey` ve her serinin `key`ini tasir. */
export interface ChartVisual {
  kind: "chart";
  chartType: ChartType;
  /** Grafigin ustunde gosterilecek kisa baslik. */
  title?: string;
  /** Yatay eksende hangi alan var (or. "yil"). */
  xKey: string;
  /** Cizilecek seriler; pie grafiginde ilki kullanilir. */
  series: Array<{ key: string; label: string }>;
  data: Array<Record<string, string | number>>;
}

/** Vektor cizim. `svg` icerigi HER ZAMAN temizlenerek saklanir. */
export interface SvgVisual {
  kind: "svg";
  title?: string;
  svg: string;
}

/** Dis kaynakli fotograf. Lisans ve kaynak gosterimi zorunlu. */
export interface ImageVisual {
  kind: "image";
  url: string;
  /** Ekran okuyucu metni; gorsel yuklenmezse de gorunur. */
  alt: string;
  /** Eser sahibi / kaynak adi. */
  credit: string;
  license: string;
  /** Kaynak sayfa baglantisi (Commons dosya sayfasi). */
  sourceUrl?: string;
}

export type QuestionVisual = ChartVisual | SvgVisual | ImageVisual;

/* -------------------------------------------------------------------------- */
/*  SVG temizleme                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Modelin urettigi SVG dogrudan sayfaya basilamaz.
 *
 * SVG calistirilabilir bir bicim: `<script>`, `on*` olay ozellikleri,
 * `<foreignObject>` icinde HTML ve `href="javascript:..."` tarayicida kod
 * kosturur. Model bunlari kotu niyetle uretmese de, KAYNAK METIN kullanicidan
 * geliyor - yuklenen bir PDF'e gomulmus talimat modeli yonlendirebilir
 * (prompt injection). Bu yuzden temizleme zorunlu, tercih degil.
 *
 * Yaklasim BEYAZ LISTE degil kara liste degil: tehlikeli yapilar tumuyle
 * sokuluyor ve sonuc yine de `<svg>` ile baslamak zorunda.
 */
export function sanitizeSvg(raw: string): string | null {
  if (typeof raw !== "string") return null;

  let svg = raw.trim();

  // Kod blogu isaretleriyle gelirse (```svg ... ```) soyuluyor.
  svg = svg.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");

  // <svg> disinda bir sey varsa (aciklama metni vb.) yalnizca etiket alinir.
  const start = svg.indexOf("<svg");
  const end = svg.lastIndexOf("</svg>");
  if (start === -1 || end === -1) return null;
  svg = svg.slice(start, end + "</svg>".length);

  const before = svg;

  svg = svg
    // Calistirilabilir icerik
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/<(?:iframe|object|embed|animate|set)\b[\s\S]*?>/gi, "")
    // Olay isleyicileri: onclick, onload, onmouseover...
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    // javascript: ve data: semalari
    .replace(/(href|xlink:href|src)\s*=\s*"(?:\s*(?:javascript|data)\s*:)[^"]*"/gi, "")
    .replace(/(href|xlink:href|src)\s*=\s*'(?:\s*(?:javascript|data)\s*:)[^']*'/gi, "")
    // <style> icinde @import ile dis kaynak cekilebilir
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "");

  // Uzunluk siniri: sayfayi kilitleyen dev cizimler engellenir.
  if (svg.length > 20_000) return null;

  // Temizlik bir sey soktuyse gunluge dusuruluyor - modelin ne urettigini
  // bilmek prompt'u duzeltmek icin gerekli.
  if (svg !== before) {
    console.warn("[visual] SVG icinden tehlikeli icerik cikarildi.");
  }

  return svg;
}

/* -------------------------------------------------------------------------- */
/*  Dogrulama                                                                 */
/* -------------------------------------------------------------------------- */

function isChart(value: Record<string, unknown>): boolean {
  return (
    typeof value.xKey === "string" &&
    value.xKey.length > 0 &&
    (CHART_TYPES as readonly string[]).includes(String(value.chartType)) &&
    Array.isArray(value.series) &&
    value.series.length > 0 &&
    value.series.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { key?: unknown }).key === "string",
    ) &&
    Array.isArray(value.data) &&
    value.data.length > 0
  );
}

/**
 * Bilinmeyen bir degeri gecerli bir gorsele cevirir; olmuyorsa null.
 *
 * Hem MODEL ciktisi hem VERITABANI satiri buradan geciyor. Veritabanindaki
 * eski satirlar bu alanı hic tasimiyor ve gorsel semasi ilerde degisebilir;
 * tek bir bozuk kayit sinav ekranini cokertmemeli.
 */
export function parseVisual(input: unknown): QuestionVisual | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;

  switch (value.kind) {
    case "chart": {
      if (!isChart(value)) return null;
      const chart = value as unknown as ChartVisual;
      return {
        kind: "chart",
        chartType: chart.chartType,
        ...(chart.title ? { title: chart.title } : {}),
        xKey: chart.xKey,
        series: chart.series.map((item) => ({
          key: item.key,
          label: item.label || item.key,
        })),
        // Satir sayisi sinirli: model yuzlerce satir uretirse grafik
        // okunamaz hale gelir.
        data: chart.data.slice(0, 40),
      };
    }

    case "svg": {
      if (typeof value.svg !== "string") return null;
      const clean = sanitizeSvg(value.svg);
      if (!clean) return null;
      return {
        kind: "svg",
        ...(typeof value.title === "string" && value.title ? { title: value.title } : {}),
        svg: clean,
      };
    }

    case "image": {
      if (typeof value.url !== "string" || !/^https:\/\//i.test(value.url)) return null;
      return {
        kind: "image",
        url: value.url,
        alt: typeof value.alt === "string" ? value.alt : "",
        credit: typeof value.credit === "string" ? value.credit : "Bilinmiyor",
        license: typeof value.license === "string" ? value.license : "Bilinmiyor",
        ...(typeof value.sourceUrl === "string" ? { sourceUrl: value.sourceUrl } : {}),
      };
    }

    default:
      return null;
  }
}

/** Gorselin tipini kullaniciya gosterilecek kisa etiket. */
export const VISUAL_LABELS: Record<QuestionVisual["kind"], string> = {
  chart: "Grafik",
  svg: "Şema",
  image: "Görsel",
};
