"use client";

import * as React from "react";
import { FileText, ListChecks, Sparkles, UserPen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { categoryLabel } from "@/lib/deneyap";
import { UNASSIGNED_SUBJECT } from "@/lib/question-pool";
import type { Question } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Sorunun kâğıt görünümlü önizlemesi.
 *
 * Havuzda soru metni tek satıra sıkışıyor; eğitmen sınava eklemeden önce
 * soruyu öğrencinin göreceği gibi okumak istiyor. Bu yüzden önizleme bilerek
 * beyaz bir yaprak gibi: koyu temada bile kâğıt beyaz kalır, tipografi punto
 * ile verilir ve açık uçlu sorunun altında cevap çizgileri görünür.
 *
 * Doğru cevap ve rubrik yalnızca eğitmene gösterilir - bu bileşen öğrenci
 * tarafında kullanılmaz.
 */

export interface QuestionPreviewDialogProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Açık uçlu sorunun altına bırakılan çizgi sayısı. */
const ANSWER_LINES = 4;

export function QuestionPreviewDialog({
  question,
  open,
  onOpenChange,
}: QuestionPreviewDialogProps) {
  if (!question) return null;

  const isTest = question.type === "test";
  const options = question.options_json ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Soru önizleme</DialogTitle>
          <DialogDescription>
            Soru, öğrencinin sınav kâğıdında göreceği düzende gösteriliyor.
            Doğru cevap ve rubrik yalnızca size görünür.
          </DialogDescription>
        </DialogHeader>

        {/* ---------- Künye ---------- */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="soft" className="font-normal">
            {categoryLabel(question.category)}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {question.subject || UNASSIGNED_SUBJECT}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {question.topic}
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-normal">
            {isTest ? (
              <ListChecks className="h-3 w-3" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            {isTest ? "Çoktan seçmeli" : "Açık uçlu"}
          </Badge>
        </div>

        {/* ---------- Kâğıt ---------- */}
        <div className="rounded-lg bg-white p-6 text-slate-900 shadow-sm ring-1 ring-slate-300">
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
                        <span className="shrink-0 font-semibold">
                          {option.key})
                        </span>
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
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Puanlama rubriği
            </p>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {question.rubric ?? "Rubrik tanımlanmamış."}
            </pre>
          </div>
        ) : null}

        {/* ---------- Alt künye ---------- */}
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
      </DialogContent>
    </Dialog>
  );
}
