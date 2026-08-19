"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatScore } from "@/lib/utils";
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Degerlendirme sirasinda hata olustu.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`answer-${questionId}`}>Cevabiniz</Label>
        <Textarea
          id={`answer-${questionId}`}
          rows={6}
          required
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Cevabinizi buraya yazin..."
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Degerlendiriliyor..." : "Cevabi gonder"}
      </Button>

      {result ? (
        <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">AI on degerlendirmesi</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatScore(result.score, maxScore)}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">{result.feedback}</p>

          {result.criteria.length > 0 ? (
            <ul className="space-y-1.5 border-t border-border pt-3">
              {result.criteria.map((criterion, index) => (
                <li key={`${criterion.criterion}-${index}`} className="text-sm">
                  <span className="font-medium">{criterion.criterion}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    {criterion.earned} / {criterion.max}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {criterion.comment}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Bu puan gecicidir; egitmen onayindan sonra kesinlesir.
          </p>
        </div>
      ) : null}
    </form>
  );
}
