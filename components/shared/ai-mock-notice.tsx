import { TriangleAlert } from "lucide-react";

export interface AiMockNoticeProps {
  /**
   * Hangi yetenegin sahte oldugunu soyler; mesaj buna göre degisir.
   * "uretim" -> soru uretimi, "puanlama" -> cevap değerlendirme.
   */
  capability: "uretim" | "puanlama";
  /** Öğrenci ekranında ortam degiskeni gibi teknik kurulum ayrıntıları gizlenir. */
  audience?: "operator" | "student";
}

const MESSAGE: Record<AiMockNoticeProps["capability"], string> = {
  uretim:
    "Üretilen sorular gerçek değil: metin şablondan geliyor, şıklar her seferinde aynı.",
  puanlama:
    "Verilen puan gerçek değil: cevabın içeriğine bakılmadan kelime sayısından hesaplanıyor.",
};

/**
 * AI mock moddayken gosterilen uyari.
 *
 * Yalnızca `[MOCK]` on eki yeterli degildi - kolayca gozden kaciyor ve
 * ciktinin gerçek sanilmasina yol aciyor. Anahtar tanimlandigi an bu bilesen
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
            Bu ortamda yapay zeka değerlendirmesi temsilidir. Nihai sonucunuz
            eğitmen onayından sonra açıklanır.
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
          Yapay zeka simülasyon modunda çalışıyor
        </p>
        <p className="leading-relaxed text-warning/90">
          {MESSAGE[capability]} Gerçek modele bağlanmak için{" "}
          <code className="rounded bg-warning/15 px-1 py-0.5 font-mono text-xs">
            .env.local
          </code>{" "}
          dosyasındaki{" "}
          <code className="rounded bg-warning/15 px-1 py-0.5 font-mono text-xs">
            OPENAI_API_KEY
          </code>{" "}
          alanına geçerli bir anahtar yazıp sunucuyu yeniden başlatın.
        </p>
      </div>
    </div>
  );
}
