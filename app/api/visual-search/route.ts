import { jsonError, jsonOk, requireRole } from "@/lib/api";
import { searchWikimediaImages } from "@/lib/visual-search";

export const runtime = "nodejs";

/** En fazla kac sonuc dondurulur. */
const LIMIT = 12;

/**
 * GET /api/visual-search?q=fotosentez
 *
 * Icerik uzmaninin ELLE fotograf aramasi (bkz. components/shared/visual-picker.tsx).
 * Arama mantigi `lib/visual-search.ts` icinde - model "referans" turu gorsel
 * istediginde de AYNI fonksiyonu kullanir (bkz. lib/ai.ts), boylece iki yolun
 * sonuclari (kaynak, lisans, kucuk resim) tutarli kalir.
 *
 * Yanit: { ok: true, data: ImageVisual[] }
 *
 * Yetki: icerik uzmani ve egitmen. Ogrenci soru hazirlamadigi icin bu ucu
 * cagirmasina gerek yok - acik bir uc noktayi disari kapatmak bedava.
 */
export async function GET(request: Request) {
  const guard = await requireRole(["icerik_uzmani", "egitmen"]);
  if (!guard.ok) return guard.response;

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return jsonError("Arama icin en az 2 karakter girin.");
  }

  const results = await searchWikimediaImages(query, LIMIT);
  return jsonOk(results);
}
