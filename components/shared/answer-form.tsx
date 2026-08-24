"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Lock,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { submitAnswer, type SubmitAnswerResult } from "@/app/actions/submissions";
import { QuestionVisual } from "@/components/shared/question-visual";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
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
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SubmitAnswerResult | null>(null);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const characterCount = answer.trim().length;
  /** Coktan secmeli mi? Otomatik kaydetmenin gecikmesi buna gore degisir. */
  const isTest = type === "test";
  const hasChanged = answer.trim() !== savedAnswer.trim();
  const meetsMinimum = type !== "acik_uclu" || answer.trim().length >= 10;
  const isTooShort = type === "acik_uclu" && characterCount > 0 && !meetsMinimum;
  const draftKey = `student-exam-draft:${studentId}:${examId}:${questionId}`;

  React.useEffect(() => {
    if (existing && !isDraft) return;
    const stored = window.sessionStorage.getItem(draftKey);
    if (stored !== null && stored !== persistedAnswer) {
      setAnswer(stored);
    }
    setDraftReady(true);
  }, [draftKey, existing, isDraft, persistedAnswer]);

  React.useEffect(() => {
    if (!draftReady || (existing && !isDraft)) return;
    if (answer.trim() && answer !== savedAnswer) {
      window.sessionStorage.setItem(draftKey, answer);
    } else {
      window.sessionStorage.removeItem(draftKey);
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

  /**
   * Cevabi kaydeder.
   *
   * Artik dugmeye basmakla degil, KENDILIGINDEN cagriliyor: sikki
   * isaretlemek zaten "cevabim bu" demek, ayrica onaylatmak gereksiz bir
   * adimdi. Acik uclu cevaplarda yazma durunca (gecikmeli) kaydediliyor -
   * her tus vurusunda gondermek sunucuyu bosuna mesgul ederdi.
   */
  async function kaydet(metin: string) {
    if (pending) return;

    setPending(true);
    setError(null);

    const response = await submitAnswer({ examId, questionId, answerText: metin });

    setPending(false);

    if (!response.ok) {
      setError(response.error);
      toast.error("Cevap kaydedilemedi", { description: response.error });
      return;
    }

    // Kalici kayitta AI puanı öğrenciye aciklanmaz; eğitmen onayı beklenir.
    setResult(response.data.persisted ? null : response.data);

    if (response.data.persisted) {
      setSavedAnswer(metin);
      window.sessionStorage.removeItem(draftKey);
    }

    // Kayit artik her isaretlemede kendiliginden oluyor; her seferinde
    // bildirim cikarmak sinav boyunca onlarca kez ekrani mesgul ederdi.
    // Durum satir icindeki gostergeden okunuyor.
    if (!response.data.persisted) {
      toast.success("Cevabınız değerlendirildi", {
        description: "Tanıtım modu: sonuç gösterildi, kayıt yapılmadı.",
      });
    }

    // Kaydedildiyse sayfayi tazele: ilerleme ve geçmiş cevaplar guncellenir.
    if (response.data.persisted) router.refresh();
  }

  /**
   * Otomatik kaydetme.
   *
   * Test sorusunda sik degisince HEMEN, acik uclu cevapta yazma durduktan
   * 1.2 saniye sonra kaydedilir. Gecikme sart: her tus vurusunda istek
   * atmak hem sunucuyu hem de ogrencinin baglantisini bosuna yorardi.
   *
   * `draftReady` beklenir: taslak geri yuklenmeden kaydetmek, geri yuklenen
   * metnin uzerine bos degeri yazabilirdi.
   */
  React.useEffect(() => {
    if (!draftReady) return;
    if (answer === savedAnswer) return;
    if (!answer.trim()) return;
    if (!meetsMinimum) return;

    const gecikme = isTest ? 0 : 1200;
    const zamanlayici = window.setTimeout(() => void kaydet(answer), gecikme);

    return () => window.clearTimeout(zamanlayici);
    // `kaydet` her render'da yeniden olusuyor; bagimlilik listesine
    // alinsaydi effect surekli tetiklenirdi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, savedAnswer, draftReady, isTest, meetsMinimum]);

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

  // Sonuc aciklandiginda cevaplanmamis soruda genel kilit mesajini tekrarlamak
  // "asagida gorebilirsiniz" beklentisi olusturuyordu. Bu soruda gosterilecek
  // cevap veya geri bildirim olmadigini dogrudan soyle.
  if (revealResults && !existing) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium text-foreground">Bu soruyu yanıtlamadınız.</p>
          <p className="mt-1">
            Kaydedilmiş bir cevap olmadığı için bu soruya ait puan veya geri
            bildirim bulunmuyor.
          </p>
        </div>
      </div>
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
      <form onSubmit={(event) => event.preventDefault()} className="space-y-3">
        {/*
          Kaydetme durumu icin serit YOK.

          Cevap kendiliginden kaydediliyor ve secilen sikkin yesil yanmasi
          ogrenciye zaten "cevabin alindi" diyor. Ustune "kaydedildi",
          "kaydedilmemis degisiklik var" gibi seritler koymak sinav boyunca
          her soruda tekrar eden bir gurultuydu.
        */}
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
                  <span className="min-w-0 flex-1">
                    {option.text}
                    {option.visual ? (
                      <QuestionVisual
                        visual={option.visual}
                        compact
                        className="mt-2"
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </fieldset>
        ) : (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`answer-${questionId}`}>Cevabınız</Label>
              <span className="text-xs tabular text-muted-foreground">
                {wordCount} kelime · {characterCount} karakter
              </span>
            </div>
            <Textarea
              id={`answer-${questionId}`}
              rows={7}
              minLength={10}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Cevabınızı buraya yazın..."
              aria-invalid={isTooShort}
              aria-describedby={`answer-help-${questionId}`}
              className={cn(
                "resize-y",
                isTooShort &&
                  "border-warning focus-visible:border-warning focus-visible:ring-warning/40",
              )}
            />
            <p
              id={`answer-help-${questionId}`}
              aria-live="polite"
              className={cn(
                "text-xs",
                isTooShort
                  ? "font-medium text-warning"
                  : answer.trim() && !hasChanged
                    ? "text-success"
                    : "text-muted-foreground",
              )}
            >
              {isTooShort
                ? `Henüz kaydedilmedi — en az 10 karakter gerekli. (${characterCount}/10)`
                : !answer.trim()
                  ? "En az 10 karakter yazın."
                  : pending || hasChanged
                    ? "Cevap otomatik olarak kaydediliyor..."
                    : "Cevap kaydedildi."}
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

        {/*
          Kaydet dugmesi kaldirildi: sikki isaretlemek zaten "cevabim bu"
          demek. Yerine ne olup bittigini soyleyen bir gosterge var -
          ogrenci cevabinin gittigini gormeli, ama bunun icin bir dugmeye
          basmak zorunda kalmamali.
        */}
        {/*
          Yalnizca istek SURERKEN gorunur. Basarili kayitta hicbir sey
          yazmiyoruz - yesil sik zaten yeterli geri bildirim. Yavas bir
          baglantida ekranin donmus gibi gorunmemesi icin bu kadari kaliyor.
        */}
        {pending && isTest ? (
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Kaydediliyor...
          </p>
        ) : null}
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
