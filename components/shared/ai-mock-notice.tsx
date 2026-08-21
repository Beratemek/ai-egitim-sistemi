import { TriangleAlert } from "lucide-react";

export interface AiMockNoticeProps {
  /**
   * Hangi yetenegin sahte oldugunu soyler; mesaj buna gore degisir.
   * "uretim" -> soru uretimi, "puanlama" -> cevap degerlendirme.
   */
  capability: "uretim" | "puanlama";
  /** Ogrenci ekraninda ortam degiskeni gibi teknik kurulum ayrintilari gizlenir. */
  audience?: "operator" | "student";
}

const MESSAGE: Record<AiMockNoticeProps["capability"], string> = {
  uretim:
    "Uretilen sorular gercek degil: metin sablondan geliyor, siklar her seferinde ayni.",
  puanlama:
    "Verilen puan gercek degil: cevabin icerigine bakilmadan kelime sayisindan hesaplaniyor.",
};

/**
 * AI mock moddayken gosterilen uyari.
 *
 * Yalnizca `[MOCK]` on eki yeterli degildi - kolayca gozden kaciyor ve
 * ciktinin gercek sanilmasina yol aciyor. Anahtar tanimlandigi an bu bilesen
 * hic render edilmez (bkz. serverEnv.aiMockMode).
 */
export function AiMockNotice({
  capability,
  audience = "operator",
}: AiMockNoticeProps) {
  if (audience === "student") {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3"
      >
        <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
        <div className="space-y-1 text-sm text-warning">
          <p className="font-semibold">Degerlendirme simulasyon modunda</p>
          <p className="leading-relaxed text-warning/90">
            Bu ortamda yapay zeka degerlendirmesi temsilidir. Nihai sonucunuz
            egitmen onayindan sonra aciklanir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3"
    >
      <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-warning">
          Yapay zeka simulasyon modunda calisiyor
        </p>
        <p className="leading-relaxed text-warning/90">
          {MESSAGE[capability]} Gercek modele baglanmak icin{" "}
          <code className="rounded bg-warning/15 px-1 py-0.5 font-mono text-xs">
            .env.local
          </code>{" "}
          dosyasindaki{" "}
          <code className="rounded bg-warning/15 px-1 py-0.5 font-mono text-xs">
            OPENAI_API_KEY
          </code>{" "}
          alanina gecerli bir anahtar yazip sunucuyu yeniden baslatin.
        </p>
      </div>
    </div>
  );
}
