"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  ChevronDown,
  CircleCheck,
  Clock,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { approveSubmissions } from "@/app/actions/submissions";
import { SubmissionReviewDialog } from "@/components/shared/submission-review-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ClassroomExamDetail, StudentExamReview } from "@/lib/queries";
import type { Question, Submission } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Sinif + sinav butun kontrolu.
 *
 * Egitmen 30 ogrencinin 20 cevabini tek tek acmaz: AI on puanlarini toplu
 * onaylar ve yalnizca itiraz ettigi cevaba dokunur. Ogrenci satiri asagi
 * dogru acilir - ayri bir pencere listede yeri kaybettirirdi.
 */

export interface ClassroomExamReviewProps {
  detail: ClassroomExamDetail;
  /** Supabase yapilandirilmamissa yazma islemleri kapatilir. */
  canPersist?: boolean;
}

export function ClassroomExamReview({
  detail,
  canPersist = true,
}: ClassroomExamReviewProps) {
  const router = useRouter();

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const questionById = React.useMemo(
    () => new Map(detail.questions.map((question) => [question.id, question])),
    [detail.questions],
  );

  /** Soru sirasi: cevabin "3. soru" oldugunu ogrenciler arasinda ayni tutar. */
  const positionById = React.useMemo(
    () =>
      new Map(detail.questions.map((question, index) => [question.id, index + 1])),
    [detail.questions],
  );

  const allPendingIds = detail.students.flatMap((student) =>
    student.submissions
      .filter((submission) => submission.status === "ai_degerlendirildi")
      .map((submission) => submission.id),
  );

  async function runApproval(key: string, ids: readonly string[], label: string) {
    if (!canPersist) {
      toast.error("Demo modunda onay kaydedilemez");
      return;
    }
    if (ids.length === 0) return;

    setBusy(key);

    try {
      const result = await approveSubmissions({ submissionIds: ids });
      if (!result.ok) throw new Error(result.error);

      const { approved, skipped, unfinished } = result.data;

      // Kismi sonuclari sessizce yutma: atlanan ya da sonuclanamayan varsa
      // egitmen bunu bilmeli, yoksa "hepsi bitti" sanip ekrandan cikar.
      const notes: string[] = [label];
      if (skipped > 0) {
        notes.push(`${skipped} cevabın AI ön puanı yok, elle puanlayın.`);
      }
      if (unfinished > 0) {
        notes.push(`${unfinished} öğrencinin sonucu hesaplanamadı.`);
      }

      const partial = skipped > 0 || unfinished > 0;
      const message = `${approved} cevap onaylandı`;

      if (partial) {
        toast.warning(message, { description: notes.join(" ") });
      } else {
        toast.success(message, { description: label });
      }

      router.refresh();
    } catch (caught) {
      toast.error("Onaylanamadı", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------- Sinif ozeti + toplu onay ---------- */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Summary label="Öğrenci" value={String(detail.students.length)} />
            <Summary label="Soru" value={String(detail.questions.length)} />
            <Summary
              label="Onay bekleyen"
              value={String(detail.pendingCount)}
              highlight={detail.pendingCount > 0}
            />
          </div>

          <Button
            className="gap-2"
            disabled={allPendingIds.length === 0 || busy !== null}
            onClick={() =>
              void runApproval(
                "all",
                allPendingIds,
                `${detail.classroom} · ${detail.exam.title}`,
              )
            }
          >
            {busy === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            {allPendingIds.length === 0
              ? "Tüm cevaplar onaylı"
              : `Sınıfın tümünü onayla (${allPendingIds.length})`}
          </Button>
        </CardContent>
      </Card>

      {detail.pendingCount > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Toplu onay, AI&apos;ın verdiği ön puanı olduğu gibi kesinleştirir.
            Katılmadığınız cevabı açıp puanını kendiniz düzeltin; düzelttiğiniz
            cevaplar toplu onaydan etkilenmez.
          </span>
        </p>
      ) : null}

      {/* ---------- Ogrenciler ---------- */}
      {detail.students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Bu sınıfta sınavı alan öğrenci yok.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {detail.students.map((student, index) => (
            <StudentRow
              key={student.studentId}
              student={student}
              first={index === 0}
              expanded={expanded === student.studentId}
              busy={busy === student.studentId}
              disabled={busy !== null}
              questionById={questionById}
              positionById={positionById}
              canPersist={canPersist}
              onToggle={() =>
                setExpanded((current) =>
                  current === student.studentId ? null : student.studentId,
                )
              }
              onApproveAll={() =>
                void runApproval(
                  student.studentId,
                  student.submissions
                    .filter((s) => s.status === "ai_degerlendirildi")
                    .map((s) => s.id),
                  student.studentName,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Summary({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-lg font-semibold tabular-nums",
          highlight && "text-amber-600 dark:text-amber-500",
        )}
      >
        {value}
      </span>
    </span>
  );
}

interface StudentRowProps {
  student: StudentExamReview;
  first: boolean;
  expanded: boolean;
  busy: boolean;
  disabled: boolean;
  questionById: Map<string, Question>;
  positionById: Map<string, number>;
  canPersist: boolean;
  onToggle: () => void;
  onApproveAll: () => void;
}

function StudentRow({
  student,
  first,
  expanded,
  busy,
  disabled,
  questionById,
  positionById,
  canPersist,
  onToggle,
  onApproveAll,
}: StudentRowProps) {
  const initials = student.studentName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");

  const submitted = student.attempt?.submitted_at ?? null;
  const score = student.approvedAverage ?? student.aiAverage;

  return (
    <div className={cn(!first && "border-t")}>
      <div className="flex flex-wrap items-center gap-3 bg-card px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {student.studentName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {submitted
                ? `Teslim: ${formatDateTime(submitted)}`
                : student.attempt
                  ? "Sınav devam ediyor"
                  : "Henüz başlamadı"}
            </span>
          </span>

          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        <div className="flex items-center gap-3">
          <span className="w-24 text-right">
            <span className="block text-xs text-muted-foreground">
              {student.approvedAverage === null ? "AI ön puanı" : "Puan"}
            </span>
            <span className="block text-sm font-semibold tabular-nums">
              {score === null ? "—" : score}
            </span>
          </span>

          {student.pendingCount > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={disabled || !canPersist}
              onClick={onApproveAll}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              {student.pendingCount} onayla
            </Button>
          ) : (
            <Badge variant="success" className="gap-1">
              <CircleCheck className="h-3 w-3" />
              Onaylı
            </Badge>
          )}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t bg-muted/30 p-4">
          {student.submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bu öğrenci henüz cevap vermemiş.
            </p>
          ) : (
            student.submissions.map((submission) => (
              <AnswerCard
                key={submission.id}
                submission={submission}
                studentName={student.studentName}
                question={
                  submission.question_id
                    ? (questionById.get(submission.question_id) ?? null)
                    : null
                }
                position={
                  submission.question_id
                    ? (positionById.get(submission.question_id) ?? null)
                    : null
                }
                canPersist={canPersist}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

interface AnswerCardProps {
  submission: Submission;
  studentName: string;
  question: Question | null;
  position: number | null;
  canPersist: boolean;
}

function AnswerCard({
  submission,
  studentName,
  question,
  position,
  canPersist,
}: AnswerCardProps) {
  const approved = submission.instructor_approved_score;
  const isApproved = submission.status === "egitmen_onayli";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
          {position !== null ? `${position}. ` : ""}
          {question?.text ?? "Soru bulunamadı"}
        </p>

        {isApproved ? (
          <Badge variant="success">Onaylı</Badge>
        ) : (
          <Badge variant="warning">Bekliyor</Badge>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/60 px-3 py-2 text-sm leading-relaxed">
        {submission.answer_text || "(boş cevap)"}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="shrink-0 text-xs text-muted-foreground">
            AI: <span className="font-semibold tabular-nums">
              {submission.ai_score ?? "—"}
            </span>
            {approved !== null ? (
              <>
                {" · "}Onaylı:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {approved}
                </span>
              </>
            ) : null}
          </span>

          <Progress
            value={approved ?? submission.ai_score ?? 0}
            className="h-1.5 max-w-[160px] flex-1"
          />
        </div>

        <SubmissionReviewDialog
          submission={submission}
          studentName={studentName}
          questionText={question?.text}
          canPersist={canPersist}
        />
      </div>

      {submission.ai_feedback ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {submission.ai_feedback}
        </p>
      ) : null}
    </div>
  );
}
