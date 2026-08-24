"use client";

import * as React from "react";
import { Check, X } from "lucide-react";

import { QuestionVisual } from "@/components/shared/question-visual";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Bir sorunun OKUNAKLI govdesi: metin, gorsel ve siklar.
 *
 * Bu bilesenin varlik sebebi, ayni sorunun projede dort ayri yerde dort
 * ayri sekilde cizilmis olmasiydi (havuz, sinav kagidi, sinav cozme ekrani,
 * onizleme paneli). Kontrol ekrani ise hicbirini almamis, soruyu duz metin
 * olarak basip ogrencinin cevabini yalnizca "A" harfi olarak gosteriyordu:
 * egitmen A'nin ne oldugunu GOREMEDEN puan onaylamak zorunda kaliyordu.
 *
 * Artik soru gosteren her ekran buradan geciyor. Bicim dili bilerek sinav
 * cozme ekranindan alindi - egitmenin gordugu ile ogrencinin gordugu ayni
 * olmali, iki ayri render yolu zamanla ayrisir.
 */

/** Bilesenin ihtiyac duydugu alanlar; tam `Question` sart degil. */
export type QuestionBodyData = Pick<
  Question,
  "text" | "type" | "options_json" | "correct_answer" | "rubric" | "visual_json"
>;

export interface QuestionBodyProps {
  question: QuestionBodyData;
  /** Sinavdaki sira numarasi; verilmezse numara cizilmez. */
  number?: number | null;
  /** Sorunun konusu; basliktaki rozetlerde gosterilir. */
  topic?: string | null;
  /** Sorunun bu sinavdaki puani. */
  points?: number | null;
  /**
   * Ogrencinin verdigi cevap.
   * Test sorusunda sik anahtari ("A"), acik uclu soruda cevap metni.
   */
  studentAnswer?: string | null;
  /**
   * Dogru sik isaretlensin mi?
   *
   * Egitmen ekranlarinda `true`. Ogrenciye sinav siriasinda gosterilirken
   * `false` olmali - bu bilesen oraya konursa kapiyi acik birakmayalim.
   */
  revealAnswer?: boolean;
  /** Acik uclu sorularda puanlama rubrigi gosterilsin mi? */
  showRubric?: boolean;
  className?: string;
}

export function QuestionBody({
  question,
  number = null,
  topic = null,
  points = null,
  studentAnswer = null,
  revealAnswer = false,
  showRubric = false,
  className,
}: QuestionBodyProps) {
  const isTest = question.type === "test";
  const options = question.options_json ?? [];

  return (
    <div className={cn("space-y-3", className)}>
      {/* ---------- Baslik seridi ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        {number !== null ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {number}
          </span>
        ) : null}
        <QuestionTypeBadge type={question.type} />
        {topic ? <Badge variant="soft">{topic}</Badge> : null}
        {points !== null ? <Badge variant="outline">{points} puan</Badge> : null}
      </div>

      {/* ---------- Soru metni ----------
          Duz `text-sm` degil: bu ekranin ASIL isi soruyu okutmak. Punto ve
          satir araligi sinav cozme ekranindakiyle ayni. */}
      <p className="text-[15px] font-medium leading-relaxed text-foreground">
        {question.text}
      </p>

      {/* Gorsel SIKLARDAN ONCE: once neye bakilacagi, sonra secenekler. */}
      {question.visual_json ? (
        <QuestionVisual visual={question.visual_json} />
      ) : null}

      {/* ---------- Siklar ---------- */}
      {isTest ? (
        options.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm italic text-muted-foreground">
            Bu soruya şık tanımlanmamış.
          </p>
        ) : (
          <ul className="space-y-2">
            {options.map((option) => {
              const isCorrect =
                revealAnswer && option.key === question.correct_answer;
              const isChosen =
                studentAnswer !== null && option.key === studentAnswer;

              return (
                <li
                  key={option.key}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 text-sm",
                    isCorrect && "border-success/50 bg-success/10",
                    isChosen && !isCorrect && "border-destructive/50 bg-destructive/10",
                    isChosen && isCorrect && "border-success/60 bg-success/15",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold",
                      isCorrect
                        ? "border-success/60 bg-success/20 text-success"
                        : isChosen
                          ? "border-destructive/60 bg-destructive/20 text-destructive"
                          : "border-input text-muted-foreground",
                    )}
                  >
                    {option.key}
                  </span>

                  <span className="min-w-0 flex-1 leading-relaxed">
                    {option.text}
                    {option.visual ? (
                      <QuestionVisual
                        visual={option.visual}
                        compact
                        className="mt-2"
                      />
                    ) : null}
                  </span>

                  {/* Etiketler: hangi sik dogru, ogrenci hangisini isaretledi.
                      Renk tek basina yeterli degil - renk korlugu ve
                      yazdirma icin yazi da gerekiyor. */}
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-success">
                        <Check className="h-3 w-3" />
                        Doğru
                      </span>
                    ) : null}
                    {isChosen ? (
                      <span
                        className={cn(
                          "flex items-center gap-1 whitespace-nowrap text-[11px] font-medium",
                          isCorrect ? "text-success" : "text-destructive",
                        )}
                      >
                        {isCorrect ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        Öğrencinin cevabı
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {/* ---------- Rubrik (yalnizca acik uclu) ---------- */}
      {!isTest && showRubric ? (
        <details className="rounded-lg border bg-muted/30 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Puanlama rubriği
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
            {question.rubric || "Rubrik tanımlanmamış."}
          </p>
        </details>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface StudentAnswerBlockProps {
  /** Ogrencinin yazdigi cevap. */
  answerText: string | null;
  className?: string;
}

/**
 * Acik uclu bir cevabin okunakli govdesi.
 *
 * Test sorularinda cevap zaten sikkin uzerinde isaretlendigi icin ayrica
 * bir kutuya gerek yok; bu blok yalnizca yazili cevaplar icin.
 */
export function StudentAnswerBlock({
  answerText,
  className,
}: StudentAnswerBlockProps) {
  const bos = !answerText || answerText.trim().length === 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Öğrencinin cevabı
      </p>
      <p
        className={cn(
          "whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed",
          bos && "italic text-muted-foreground",
        )}
      >
        {bos ? "(boş cevap)" : answerText}
      </p>
    </div>
  );
}
