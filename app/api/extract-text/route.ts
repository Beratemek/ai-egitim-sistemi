import { errorMessage, jsonError, jsonOk, requireRole } from "@/lib/api";

// PDF ve DOCX cozumleyicileri Node.js API'lerine ihtiyac duyar.
export const runtime = "nodejs";
export const maxDuration = 60;

/** Kabul edilen en buyuk dosya boyutu. */
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Modele gonderilecek metin icin ust sinir - cok uzun metin baglami sisirir. */
const MAX_CHARS = 40_000;

export interface ExtractTextResult {
  /** Cikarilan duz metin. */
  text: string;
  /** Kaynak dosya adi. */
  fileName: string;
  /** Karakter sayisi (kirpilmadan ONCE). */
  chars: number;
  /** MAX_CHARS asildigi icin kirpildi mi? */
  truncated: boolean;
  /** PDF ise sayfa sayisi. */
  pages?: number;
}

/** Bosluklari toparlar: PDF cikarimlarinda cok sayida bos satir olusur. */
function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  return { text: Array.isArray(text) ? text.join("\n\n") : text, pages: totalPages };
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

/**
 * POST /api/extract-text
 *
 * Govde: multipart/form-data, `file` alani (PDF, DOCX, TXT veya MD).
 * Yanit: { ok: true, data: ExtractTextResult }
 *
 * Dosya SUNUCUDA cozumlenir ve yalnizca duz metin geri doner; hicbir yere
 * kaydedilmez. Kullanici metni formda gorup duzenleyebildigi icin AI'a ne
 * gittigi seffaf kalir.
 *
 * Yetki: icerik uzmani ve egitmen.
 */
export async function POST(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Dosya bulunamadi. 'file' alanini gonderin.");
    }

    if (file.size === 0) return jsonError("Dosya bos.");
    if (file.size > MAX_BYTES) {
      return jsonError(
        `Dosya cok buyuk (${(file.size / 1024 / 1024).toFixed(1)} MB). Sinir 10 MB.`,
      );
    }

    const name = file.name.toLocaleLowerCase("tr");
    const buffer = Buffer.from(await file.arrayBuffer());

    let raw: string;
    let pages: number | undefined;

    if (name.endsWith(".pdf")) {
      const result = await extractPdf(buffer);
      raw = result.text;
      pages = result.pages;
    } else if (name.endsWith(".docx")) {
      raw = await extractDocx(buffer);
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      raw = buffer.toString("utf8");
    } else if (name.endsWith(".doc")) {
      // Eski ikili .doc bicimi acilamaz; kullaniciyi dogru yola yonlendir.
      return jsonError(
        "Eski .doc bicimi desteklenmiyor. Word'de 'Farkli Kaydet > .docx' yapip tekrar deneyin.",
      );
    } else {
      return jsonError("Desteklenen bicimler: PDF, DOCX, TXT, MD.");
    }

    const text = tidy(raw);

    if (text.length < 20) {
      return jsonError(
        pages !== undefined
          ? "PDF'ten metin cikarilamadi. Dosya taranmis (goruntu) olabilir; metin katmani iceren bir PDF deneyin."
          : "Dosyadan anlamli metin cikarilamadi.",
      );
    }

    const truncated = text.length > MAX_CHARS;

    return jsonOk<ExtractTextResult>({
      text: truncated ? text.slice(0, MAX_CHARS) : text,
      fileName: file.name,
      chars: text.length,
      truncated,
      ...(pages !== undefined ? { pages } : {}),
    });
  } catch (caught) {
    return jsonError(`Dosya okunamadi: ${errorMessage(caught)}`, 500);
  }
}
