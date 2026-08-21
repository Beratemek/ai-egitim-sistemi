"use client";

import * as React from "react";
import { Sparkles, UserPen } from "lucide-react";

import type { Question } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Sorunun kâğıt görünümlü önizlemesi.
 *
 * Ayrı bir pencere açmak yerine soru satırının ALTINDA açılır: eğitmen listede
 * yerini kaybetmeden soruyu okuyup bir sonrakine geçebilsin.
 *
 * Kâğıt bilerek beyaz: koyu temada bile öğrencinin göreceği düzeni taklit
 * eder, tipografi punto ile verilir. Doğru cevap ve rubrik yalnızca eğitmene
 * gösterilir - bu bileşen öğrenci tarafında kullanılmaz.
 */

export interface QuestionPreviewPanelProps {
  question: Question;
}

/** Açık uçlu sorunun altına bırakılan çizgi sayısı. */
const ANSWER_LINES = 4;

export function QuestionPreviewPanel({ question }: QuestionPreviewPanelProps) {
  const isTest = question.type === "test";
  const options = question.options_json ?? [];

  return (
    <div className="space-y-3 border-t bg-muted/30 p-4">
      {/* ---------- Kâğıt ---------- */}
      <div className="rounded-lg bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-300">
        <div className="flex gap-3">
          <span className="shrink-0 text-[11pt] font-bold tabular">1.</span>

          <div className="min-w-0 flex-1">
            <p className="text-[11pt] leading-[1.45]">{question.text}</p>

            {isTest ? (
              <ol className="mt-3 space-y-1.5 text-[10.5pt] leading-[1.35]">
                {options.map((option) => {
                  const isCorrect = option.key === question.correct_answer;

                  return (
                    <li
                      key={option.key}
                      className={cn(
                        "flex gap-2 rounded px-1.5 py-0.5",
                        isCorrect && "bg-emerald-100 font-medium",
                      )}
                    >
                      <span className="shrink-0 font-semibold">{option.key})</span>
                      <span className="min-w-0">{option.text}</span>
                      {isCorrect ? (
                        <span className="ml-auto shrink-0 text-[8.5pt] font-semibold uppercase tracking-wide text-emerald-700">
                          doğru
                        </span>
                      ) : null}
                    </li>
                  );
                })}

                {options.length === 0 ? (
                  <li className="text-[10pt] italic text-slate-500">
                    Bu soruya şık tanımlanmamış.
                  </li>
                ) : null}
              </ol>
            ) : (
              <div className="mt-4 space-y-5" aria-hidden>
                {Array.from({ length: ANSWER_LINES }, (_, line) => (
                  <div
                    key={line}
                    className="border-b border-dotted border-slate-400"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Rubrik (yalnızca açık uçlu) ---------- */}
      {!isTest ? (
        <div className="rounded-lg border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Puanlama rubriği
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {question.rubric ?? "Rubrik tanımlanmamış."}
          </pre>
        </div>
      ) : null}

      {/* ---------- Künye ---------- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {question.ai_generated ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <UserPen className="h-3.5 w-3.5" />
          )}
          {question.ai_generated ? "AI üretti" : "Elle eklendi"}
        </span>
        <span aria-hidden>&middot;</span>
        <span>{formatDateTime(question.created_at)}</span>
      </div>
    </div>
  );
}
