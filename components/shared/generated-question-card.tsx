"use client";

import * as React from "react";
import { Check, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { recordPreference } from "@/app/actions/questions";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { QuestionReviseDialog } from "@/components/shared/question-revise-dialog";
import { Button } from "@/components/ui/button";
import type { DeneyapCategory } from "@/lib/deneyap";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GeneratedQuestion, PreferenceVerdict } from "@/lib/types";

const DIFFICULTY_VARIANT: Record<
  GeneratedQuestion["difficulty"],
  "success" | "warning" | "danger"
> = {
  kolay: "success",
  orta: "warning",
  zor: "danger",
};

export interface GeneratedQuestionCardProps {
  question: GeneratedQuestion;
  /** Düzenleme/revizyon diyalogu için ek baglam. */
  kazanım?: string;
  context?: string;
  category?: DeneyapCategory;
  /** Elle düzenleme veya AI revizyonu sonucu; taslağı yerinde degistirir. */
  onReplace?: (question: GeneratedQuestion) => void;
  /** Seçili DENEYAP atölye dalı adi; rozet olarak gösterilir. */
  categoryName?: string;
  index: number;
  /** Havuza gonderilmek uzere seçili mi? */
  selected: boolean;
  onToggleSelected: (selected: boolean) => void;
  outcomeId?: string;
}

/**
 * Tek bir AI taslağı.
 *
 * Begen / begenme dugmeleri taslağı tercih hafizasina yazar; bir sonraki
 * üretimde model bu ornekleri gorur. Begenmedigi taslaga uzman kısa bir
 * gerekçe de yazabilir - o gerekçe de modele gider.
 */
export function GeneratedQuestionCard({
  question,
  categoryName,
  kazanım,
  context,
  category,
  onReplace,
  index,
  selected,
  onToggleSelected,
  outcomeId,
}: GeneratedQuestionCardProps) {
  const [verdict, setVerdict] = React.useState<PreferenceVerdict | null>(null);
  const [pending, setPending] = React.useState<PreferenceVerdict | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  async function submitVerdict(next: PreferenceVerdict, withNote?: string) {
    setPending(next);

    const result = await recordPreference({
      question,
      verdict: next,
      ...(withNote ? { note: withNote } : {}),
      ...(outcomeId ? { outcomeId } : {}),
    });

    setPending(null);

    if (!result.ok) {
      toast.error("Geri bildirim kaydedilemedi", { description: result.error });
      return;
    }

    setVerdict(next);
    setNoteOpen(false);

    if (next === "begendi") {
      // Begenilen soru dogal olarak havuza da aday.
      onToggleSelected(true);
      toast.success("Beğeni kaydedildi", {
        description: "AI bir sonraki üretimde bu tarzı daha çok kullanacak.",
      });
    } else {
      onToggleSelected(false);
      toast.success("Geri bildirim kaydedildi", {
        description: "AI bu tarzdan uzak duracak.",
      });
    }
  }

  return (
    <Card
      className={cn(
        "transition-colors",
        verdict === "begendi" && "border-success/40 bg-success/[0.03]",
        verdict === "begenmedi" && "border-destructive/30 opacity-70",
      )}
    >
      {/*
        Duzen: SABIT GENISLIKTE bir oluk (secim kutusu + sira numarasi) ve
        yaninda tek bir icerik sutunu.

        Onceki surumde secim kutusu, sira, tip, zorluk, dal ve konu TEK bir
        `flex-wrap` icindeydi. Dar kolonda her kart farkli yerden sariyordu:
        birinde konu ikinci satira duşuyor, otekinde rozetlerin yani sira
        kaliyordu. Soru metinleri de karttan karta farkli soldan basliyordu,
        goz asagi tararken tutunacak bir hiza bulamiyordu - "dagi̇nik"
        gorunmesinin sebebi buydu.

        Simdi her kartta soru metni AYNI x konumundan basliyor ve kunye
        (tip/zorluk/dal) kendi satirinda duruyor.
      */}
      <CardContent className="flex gap-3 p-4">
        {/* Oluk: secim + sira. Genislik sabit ki icerik sutunu hizalansin. */}
        <div className="flex w-7 shrink-0 flex-col items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onToggleSelected(event.target.checked)}
            className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
            aria-label={`${index + 1}. soruyu havuza gönder`}
          />
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {/* Kunye: tek satir, sabit sira. Konu buraya karismaz. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <QuestionTypeBadge type={question.type} />
            <Badge variant={DIFFICULTY_VARIANT[question.difficulty]}>
              {question.difficulty}
            </Badge>
            {categoryName ? (
              <Badge variant="soft" className="font-normal">
                {categoryName}
              </Badge>
            ) : null}

            {verdict ? (
              <Badge
                variant={verdict === "begendi" ? "success" : "danger"}
                className="ml-auto gap-1.5"
              >
                {verdict === "begendi" ? (
                  <ThumbsUp className="h-3 w-3" />
                ) : (
                  <ThumbsDown className="h-3 w-3" />
                )}
                {verdict === "begendi" ? "Beğenildi" : "Beğenilmedi"}
              </Badge>
            ) : null}
          </div>

          {/* Konu kendi satirinda: rozetlerin arasinda kaybolmasin. */}
          {question.topic ? (
            <p className="text-xs text-muted-foreground">{question.topic}</p>
          ) : null}

          <p className="font-medium leading-relaxed">{question.text}</p>

          {question.type === "test" ? (
            <ul className="space-y-1">
              {(question.options ?? []).map((option) => {
                const isCorrect = option.key === question.correct_answer;

                return (
                  <li
                    key={option.key}
                    className={cn(
                      "flex gap-2 rounded-md px-2 py-1.5 text-sm leading-relaxed",
                      isCorrect
                        ? "bg-success/10 font-medium text-success"
                        : "text-muted-foreground",
                    )}
                  >
                    {/* Sik harfi sabit genislikte: uzun sik metni ikinci
                        satira sarinca harfin altina degil, METNIN altina
                        hizalanir. */}
                    <span className="w-4 shrink-0 font-mono text-xs leading-relaxed opacity-70">
                      {option.key})
                    </span>
                    <span className="min-w-0 flex-1">{option.text}</span>
                    {isCorrect ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rubrik
              </p>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {question.rubric}
              </pre>
            </div>
          )}

          {/* ---------- Geri bildirim ---------- */}
          {/*
            Buradaki "Geri bildirim AI'in bir sonraki uretimini sekillendirir"
            cumlesi KALDIRILDI: her kartta tekrar edince on soruluk bir
            listede ayni cumle on kez okunuyordu. Artik bolum basliginda bir
            kez yaziyor.
          */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              type="button"
              size="sm"
              variant={verdict === "begendi" ? "default" : "outline"}
              className="gap-1.5"
              disabled={pending !== null}
              onClick={() => void submitVerdict("begendi")}
            >
              {pending === "begendi" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              Beğendim
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              disabled={pending !== null}
              onClick={() => setNoteOpen((open) => !open)}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              Beğenmedim
            </Button>

            {onReplace ? (
              <QuestionReviseDialog
                question={question}
                index={index}
                onSave={onReplace}
                {...(kazanım ? { kazanım } : {})}
                {...(context ? { context } : {})}
                {...(category ? { category } : {})}
              />
            ) : null}
          </div>

          {noteOpen ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 sm:flex-row">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nesi eksik? (örnek: çeldiriciler zayıf, çok kolay)"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending !== null}
                onClick={() => void submitVerdict("begenmedi", note.trim() || undefined)}
              >
                {pending === "begenmedi" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Gönder
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
