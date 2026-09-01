import { Check, Lightbulb, ListOrdered, Sparkles, X } from "lucide-react";

import type { QuestionSolution } from "@/lib/solution";
import { cn } from "@/lib/utils";

export interface QuestionSolutionProps {
  solution: QuestionSolution;
  /** Öğrencinin işaretlediği şık; varsa o satır vurgulanır. */
  studentAnswer?: string | null;
  className?: string;
}

/**
 * Bir sorunun adım adım çözümü.
 *
 * SIRA BİLİNÇLİ: kavram → adımlar → şıklar → sonuç. Önce kural kurulur,
 * sonra uygulanır, sonra elemeler yapılır, en son cevap söylenir. Cevabı
 * başa koymak öğrenciyi gerisini okumaktan alıkoyuyor - amaç cevabı
 * bildirmek değil, nasıl bulunacağını göstermek.
 *
 * ADIMLAR VE ŞIKLAR İSTEĞE BAĞLI: matematikte adımlar dolu gelir, tarihte
 * boş; açık uçlu soruda şık bölümü hiç çizilmez. Boş bölüm başlığıyla
 * birlikte gizleniyor, "Adımlar: (yok)" gibi bir boşluk kalmıyor.
 *
 * ÖĞRENCİNİN ŞIKKI VURGULANIR: kendi seçtiğini listede bulup neden yanlış
 * olduğunu okuması, doğru cevabı öğrenmesinden daha öğretici. Vurgu yalnızca
 * bir kenarlık - renk tek başına bilgi taşımıyor, satırda "Senin cevabın"
 * etiketi de var (renk körlüğü ve yazdırma için).
 */
export function QuestionSolution({
  solution,
  studentAnswer = null,
  className,
}: QuestionSolutionProps) {
  return (
    <section
      className={cn("rounded-xl border bg-card/60 p-4", className)}
      aria-label="Sorunun çözümü"
    >
      {/* ---------- Kavram ---------- */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Lightbulb className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kural / kavram
          </h3>
          <p className="mt-1 text-sm leading-relaxed">{solution.concept}</p>
        </div>
      </div>

      {/* ---------- Adımlar ---------- */}
      {solution.steps.length > 0 ? (
        <div className="mt-4 flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ListOrdered className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Çözüm adımları
            </h3>
            <ol className="mt-2 space-y-2">
              {solution.steps.map((step, index) => (
                <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {/* ---------- Şık şık değerlendirme ---------- */}
      {solution.options.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Şıklar neden doğru ya da yanlış
          </h3>
          <ul className="mt-2 space-y-2">
            {solution.options.map((option) => {
              const secilen =
                studentAnswer !== null &&
                option.key.toLocaleUpperCase("tr") ===
                  studentAnswer.trim().toLocaleUpperCase("tr");

              return (
                <li
                  key={option.key}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-sm",
                    option.correct && "border-success/50 bg-success/10",
                    secilen && !option.correct && "border-destructive/50 bg-destructive/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold",
                      option.correct
                        ? "border-success/60 bg-success/20 text-success"
                        : "border-input text-muted-foreground",
                    )}
                  >
                    {option.key}
                  </span>

                  <span className="min-w-0 flex-1 leading-relaxed">
                    {option.reason}
                  </span>

                  {/* Renk tek basina bilgi tasimasin: yazi da var. */}
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {option.correct ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                        <Check className="h-3 w-3" />
                        Doğru
                      </span>
                    ) : null}
                    {secilen ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 whitespace-nowrap text-[11px] font-medium",
                          option.correct ? "text-success" : "text-destructive",
                        )}
                      >
                        {option.correct ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        Senin cevabın
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* ---------- Sonuç ---------- */}
      <div className="mt-4 rounded-lg bg-muted/50 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sonuç
        </h3>
        <p className="mt-1 text-sm leading-relaxed">{solution.conclusion}</p>
      </div>

      {/*
        YAPAY ZEKA NOTU ZORUNLU.

        Cozumler icerik uzmaninin onayina girmiyor (bilincli karar, bkz.
        lib/solution.ts). Ogrenci okudugu metnin kaynagini bilmeli ve
        supheye dusunce ogretmenine sorabilecegini anlamali. Kocta da ayni
        not var; iki yuzey ayni dili konusuyor.
      */}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Bu çözüm yapay zekâ tarafından hazırlandı. Anlamadığın ya da hatalı
          bulduğun bir yer olursa öğretmenine sor.
        </span>
      </p>
    </section>
  );
}
