"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Send, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { submitAnswer, type SubmitAnswerResult } from "@/app/actions/submissions";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { QuestionOption, QuestionType, Submission } from "@/lib/types";

export interface AnswerFormProps {
  examId: string;
  questionId: string;
  type: QuestionType;
  /** Coktan secmeli sorunun siklari. */
  options?: readonly QuestionOption[] | null;
  maxScore?: number;
  /** Daha once verilmis cevap. Varsa form kilitlenir, sonuc gosterilir. */
  existing?: Submission | null;
}

/**
 * Ogrencinin bir soruya cevabini alir, kaydeder ve AI on degerlendirmesini gosterir.
 *
 * Rubrik ve dogru cevap ISTEMCIYE HIC GELMEZ; puanlama sunucuda,
 * veritabanindan okunan degerlerle yapilir (bkz. app/actions/submissions.ts).
 * Nihai puan her zaman egitmen onayindan sonra kesinlesir.
 */
export function AnswerForm({
  examId,
  questionId,
  type,
  options,
  maxScore = 100,
  existing = null,
}: AnswerFormProps) {
  const router = useRouter();

  const [answer, setAnswer] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SubmitAnswerResult | null>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const canSubmit = answer.trim().length > 0 && !pending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await submitAnswer({ examId, questionId, answerText: answer });

    setPending(false);

    if (!response.ok) {
      setError(response.error);
      toast.error("Cevap gonderilemedi", { description: response.error });
      return;
    }

    setResult(response.data);

    toast.success(
      response.data.persisted ? "Cevabiniz kaydedildi" : "Cevabiniz degerlendirildi",
      {
        description: response.data.persisted
          ? "Nihai puan egitmen onayindan sonra kesinlesir."
          : "Demo modu: sonuc gosterildi ama veritabanina yazilmadi.",
      },
    );

    // Kaydedildiyse sayfayi tazele: ilerleme ve gecmis cevaplar guncellenir.
    if (response.data.persisted) router.refresh();
  }

  // Daha once cevaplanmis soru: kayitli sonucu goster, formu acma.
  if (existing) {
    return <AnsweredView submission={existing} maxScore={maxScore} options={options} />;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {type === "test" ? (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Dogru sikki secin</legend>
            {(options ?? []).map((option) => {
              const isSelected = answer === option.key;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setAnswer(option.key)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:border-primary/40 hover:bg-accent/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground",
                    )}
                  >
                    {option.key}
                  </span>
                  <span className="min-w-0 flex-1">{option.text}</span>
                </button>
              );
            })}
          </fieldset>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`answer-${questionId}`}>Cevabiniz</Label>
              <span className="text-xs text-muted-foreground">{wordCount} kelime</span>
            </div>
            <Textarea
              id={`answer-${questionId}`}
              rows={7}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Cevabinizi buraya yazin..."
              className="resize-y"
            />
          </div>
        )}

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button type="submit" className="gap-2" disabled={!canSubmit}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gonderiliyor...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Cevabi gonder
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Cevabinizi bir kez gonderebilirsiniz.
        </p>
      </form>

      {result ? (
        <GradePanel
          score={result.score}
          feedback={result.feedback}
          criteria={result.criteria}
          maxScore={maxScore}
          persisted={result.persisted}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cevaplanmis soru gorunumu                                                 */
/* -------------------------------------------------------------------------- */

function AnsweredView({
  submission,
  maxScore,
  options,
}: {
  submission: Submission;
  maxScore: number;
  options?: readonly QuestionOption[] | null;
}) {
  const isApproved = submission.status === "egitmen_onayli";
  const finalScore = submission.instructor_approved_score ?? submission.ai_score;

  // Coktan secmelide cevap sik anahtaridir; okunabilir hale getirilir.
  const chosen = options?.find((option) => option.key === submission.answer_text);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Cevabiniz
          </span>
          <SubmissionStatusBadge status={submission.status} />
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {chosen ? `${chosen.key}) ${chosen.text}` : submission.answer_text}
        </p>
      </div>

      <GradePanel
        score={finalScore}
        feedback={submission.ai_feedback}
        criteria={[]}
        maxScore={maxScore}
        persisted
        isApproved={isApproved}
        instructorNote={submission.instructor_note}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Puan paneli                                                               */
/* -------------------------------------------------------------------------- */

function GradePanel({
  score,
  feedback,
  criteria,
  maxScore,
  persisted,
  isApproved = false,
  instructorNote = null,
}: {
  score: number | null;
  feedback: string | null;
  criteria: SubmitAnswerResult["criteria"];
  maxScore: number;
  persisted: boolean;
  isApproved?: boolean;
  instructorNote?: string | null;
}) {
  if (score === null) {
    return (
      <p className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
        Bu cevap dogrudan egitmen tarafindan puanlanacak.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">
          {isApproved ? "Egitmen onayli puan" : "AI on degerlendirmesi"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Toplam puan</span>
          <span className="text-2xl font-semibold tabular">
            {score}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {maxScore}
            </span>
          </span>
        </div>
        <Progress value={(score / maxScore) * 100} className="h-2" />
      </div>

      {feedback ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{feedback}</p>
      ) : null}

      {criteria.length > 0 ? (
        <>
          <Separator />
          <ul className="space-y-3">
            {criteria.map((criterion, index) => (
              <li key={`${criterion.criterion}-${index}`} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{criterion.criterion}</span>
                  <span className="shrink-0 text-sm tabular text-muted-foreground">
                    {criterion.earned} / {criterion.max}
                  </span>
                </div>
                <Progress
                  value={criterion.max > 0 ? (criterion.earned / criterion.max) * 100 : 0}
                  className="h-1.5"
                />
                <p className="text-xs text-muted-foreground">{criterion.comment}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {instructorNote ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-xs leading-relaxed text-success">
          <span className="font-medium">Egitmen notu: </span>
          {instructorNote}
        </p>
      ) : null}

      {isApproved ? null : (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {persisted
            ? "Bu puan gecicidir; egitmen onayindan sonra kesinlesir."
            : "Demo modu: sonuc veritabanina yazilmadi."}
        </p>
      )}
    </div>
  );
}
