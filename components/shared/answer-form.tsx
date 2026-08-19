"use client";

import * as React from "react";
import { Loader2, Send, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ApiResponse, GradeAnswerRequest, GradingResult } from "@/lib/types";

export interface AnswerFormProps {
  questionId: string;
  questionText: string;
  rubric: string;
  maxScore?: number;
}

/**
 * Ogrencinin acik uclu cevabini alir ve AI on degerlendirmesini gosterir.
 * Nihai puan her zaman egitmen onayindan sonra kesinlesir.
 */
export function AnswerForm({
  questionId,
  questionText,
  rubric,
  maxScore = 100,
}: AnswerFormProps) {
  const [answer, setAnswer] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<GradingResult | null>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload: GradeAnswerRequest = {
      studentAnswer: answer,
      rubric,
      questionText,
      maxScore,
    };

    try {
      const response = await fetch("/api/ai/grade-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as ApiResponse<GradingResult>;
      if (!body.ok) throw new Error(body.error);

      setResult(body.data);
      toast.success("Cevabiniz degerlendirildi", {
        description: "Nihai puan egitmen onayindan sonra kesinlesir.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Degerlendirme sirasinda hata olustu.";
      setError(message);
      toast.error("Degerlendirilemedi", { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor={`answer-${questionId}`}>Cevabiniz</Label>
            <span className="text-xs text-muted-foreground">{wordCount} kelime</span>
          </div>
          <Textarea
            id={`answer-${questionId}`}
            rows={7}
            required
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Cevabinizi buraya yazin..."
            className="resize-y"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button type="submit" className="gap-2" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Degerlendiriliyor...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Cevabi gonder
            </>
          )}
        </Button>
      </form>

      {result ? (
        <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">AI on degerlendirmesi</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Toplam puan</span>
              <span className="text-2xl font-semibold tabular">
                {result.score}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {maxScore}
                </span>
              </span>
            </div>
            <Progress value={(result.score / maxScore) * 100} className="h-2" />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.feedback}
          </p>

          {result.criteria.length > 0 ? (
            <>
              <Separator />
              <ul className="space-y-3">
                {result.criteria.map((criterion, index) => (
                  <li key={`${criterion.criterion}-${index}`} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{criterion.criterion}</span>
                      <span className="shrink-0 text-sm tabular text-muted-foreground">
                        {criterion.earned} / {criterion.max}
                      </span>
                    </div>
                    <Progress
                      value={
                        criterion.max > 0 ? (criterion.earned / criterion.max) * 100 : 0
                      }
                      className="h-1.5"
                    />
                    <p className="text-xs text-muted-foreground">{criterion.comment}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            Bu puan gecicidir; egitmen onayindan sonra kesinlesir.
          </p>
        </div>
      ) : null}
    </div>
  );
}
