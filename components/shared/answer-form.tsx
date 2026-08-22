"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
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
  studentId: string;
  type: QuestionType;
  /** Çoktan seçmeli sorunun siklari. */
  options?: readonly QuestionOption[] | null;
  maxScore?: number;
  /** `gonderildi` durumundaysa duzenlenebilir; sonraki durumlarda kilitlenir. */
  existing?: Submission | null;
  /** Sınav zaman penceresi disindaysa form acilmaz ve bu açıklama gösterilir. */
  disabledReason?: string | null;
  /** Puan ve AI geri bildirimi ancak tüm sınav sonuclandiginda açılır. */
  revealResults?: boolean;
}

/**
 * Öğrencinin cevabini taslak olarak kaydeder ve sınav teslim edilene kadar
 * duzenlemesine izin verir.
 *
 * Rubrik ve doğru cevap ISTEMCIYE HIC GELMEZ; puanlama sunucuda,
 * veritabanindan okunan degerlerle yapilir (bkz. app/actions/submissions.ts).
 * Nihai puan her zaman eğitmen onayından sonra kesinleşir.
 */
export function AnswerForm({
  examId,
  questionId,
  studentId,
  type,
  options,
  maxScore = 100,
  existing = null,
  disabledReason = null,
  revealResults = false,
}: AnswerFormProps) {
  const router = useRouter();

  const isDraft = existing?.status === "gonderildi";
  const persistedAnswer = isDraft ? existing.answer_text : "";
  const [answer, setAnswer] = React.useState(persistedAnswer);
  const [savedAnswer, setSavedAnswer] = React.useState(persistedAnswer);
  const [draftReady, setDraftReady] = React.useState(false);
  const [restoredDraft, setRestoredDraft] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SubmitAnswerResult | null>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const hasChanged = answer.trim() !== savedAnswer.trim();
  const meetsMinimum = type !== "acik_uclu" || answer.trim().length >= 10;
  const canSubmit = answer.trim().length > 0 && meetsMinimum && hasChanged && !pending;
  const draftKey = `student-exam-draft:${studentId}:${examId}:${questionId}`;

  React.useEffect(() => {
    if (existing && !isDraft) return;
    const stored = window.sessionStorage.getItem(draftKey);
    if (stored !== null && stored !== persistedAnswer) {
      setAnswer(stored);
      setRestoredDraft(true);
    }
    setDraftReady(true);
  }, [draftKey, existing, isDraft, persistedAnswer]);

  React.useEffect(() => {
    if (!draftReady || (existing && !isDraft)) return;
    if (answer.trim() && answer !== savedAnswer) {
      window.sessionStorage.setItem(draftKey, answer);
    } else {
      window.sessionStorage.removeItem(draftKey);
      setRestoredDraft(false);
    }
  }, [answer, draftKey, draftReady, existing, isDraft, savedAnswer]);

  React.useEffect(() => {
    if (!hasChanged || !answer.trim()) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [answer, hasChanged]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await submitAnswer({ examId, questionId, answerText: answer });

    setPending(false);

    if (!response.ok) {
      setError(response.error);
      toast.error("Cevap kaydedilemedi", { description: response.error });
      return;
    }

    // Kalici kayitta AI puanı öğrenciye aciklanmaz; eğitmen onayı beklenir.
    setResult(response.data.persisted ? null : response.data);

    if (response.data.persisted) {
      setSavedAnswer(answer);
      setRestoredDraft(false);
      window.sessionStorage.removeItem(draftKey);
    }

    toast.success(
      response.data.persisted ? "Cevabınız kaydedildi" : "Cevabınız değerlendirildi",
      {
        description: response.data.persisted
          ? "Sınavı bitirene kadar cevabınızı değiştirebilirsiniz."
          : "Tanıtım modu: sonuç gösterildi, kayıt yapılmadı.",
      },
    );

    // Kaydedildiyse sayfayi tazele: ilerleme ve geçmiş cevaplar guncellenir.
    if (response.data.persisted) router.refresh();
  }

  // AI'a gonderilmis cevap artık degistirilemez.
  if (existing && !isDraft) {
    return (
      <AnsweredView
        submission={existing}
        maxScore={maxScore}
        options={options}
        revealResults={revealResults}
      />
    );
  }

  if (disabledReason) {
    const chosen = options?.find((option) => option.key === existing?.answer_text);
    return (
      <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{disabledReason}</p>
        </div>
        {existing ? (
          <p className="whitespace-pre-wrap rounded-lg bg-background px-3 py-2 text-foreground">
            {chosen
              ? `${chosen.key}) ${chosen.text}`
              : existing.answer_text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {hasChanged && answer.trim() ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {restoredDraft
                ? "Kaydedilmemiş taslağınız bu sekmede geri yüklendi. Veritabanına kaydetmek için Cevabı kaydet'e basın."
                : "Kaydedilmemiş değişiklikleriniz var."}
            </span>
          </div>
        ) : savedAnswer ? (
          <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Bu sorunun son değişiklikleri kaydedildi.
          </div>
        ) : null}

        {isDraft ? (
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
            <span>Cevabınız kaydedildi; sınavı bitirene kadar düzenleyebilirsiniz.</span>
            <SubmissionStatusBadge status="gonderildi" />
          </div>
        ) : null}

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
              <Label htmlFor={`answer-${questionId}`}>Cevabınız</Label>
              <span className="text-xs text-muted-foreground">{wordCount} kelime</span>
            </div>
            <Textarea
              id={`answer-${questionId}`}
              rows={7}
              minLength={10}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Cevabınızı buraya yazın..."
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              En az 10 karakter yazın.
            </p>
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
              <Save className="h-4 w-4" />
              {isDraft ? "Değişiklikleri kaydet" : "Cevabı kaydet"}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Cevaplarınız, sınavı bitirme adimina kadar taslak olarak saklanir.
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
  revealResults,
}: {
  submission: Submission;
  maxScore: number;
  options?: readonly QuestionOption[] | null;
  revealResults: boolean;
}) {
  const isApproved =
    revealResults && submission.status === "egitmen_onayli";

  // Çoktan secmelide cevap seçenek anahtaridir; okunabilir hale getirilir.
  const chosen = options?.find((option) => option.key === submission.answer_text);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Cevabınız
          </span>
          {revealResults ? (
            <SubmissionStatusBadge status={submission.status} />
          ) : (
            <span className="rounded-full bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
              Değerlendirmede
            </span>
          )}
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {chosen ? `${chosen.key}) ${chosen.text}` : submission.answer_text}
        </p>
      </div>

      {isApproved ? (
        <GradePanel
          score={submission.instructor_approved_score}
          feedback={submission.ai_feedback}
          criteria={submission.ai_criteria_json ?? []}
          maxScore={maxScore}
          persisted
          isApproved
          instructorNote={submission.instructor_note}
        />
      ) : (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          Puan ve geri bildirim, sınavın tüm soruları eğitmen tarafından
          onaylandiktan sonra açıklanacak.
        </p>
      )}
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
        Bu cevap doğrudan eğitmen tarafından puanlanacak.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">
          {isApproved ? "Eğitmen onaylı puan" : "AI on değerlendirmesi"}
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
            ? "Bu puan geçicidir; eğitmen onayından sonra kesinleşir."
            : "Tanıtım modu: sonuç kaydedilmedi."}
        </p>
      )}
    </div>
  );
}
