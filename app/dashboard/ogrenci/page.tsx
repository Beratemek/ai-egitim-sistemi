import type { Metadata } from "next";

import { AnswerForm } from "@/components/shared/answer-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_EXAMS, MOCK_QUESTIONS, MOCK_SUBMISSIONS } from "@/lib/mock-data";
import { formatDateTime, formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Ogrenci" };

export default function OgrenciPage() {
  const publishedExams = MOCK_EXAMS.filter((exam) => exam.is_published);

  // Demo: onaylanmis ilk acik uclu soru uzerinden cevap akisini gosteriyoruz.
  const openQuestion = MOCK_QUESTIONS.find(
    (question) => question.type === "acik_uclu" && question.status === "onayli",
  );

  const finalScores = MOCK_SUBMISSIONS.map(
    (submission) => submission.instructor_approved_score ?? submission.ai_score,
  ).filter((score): score is number => score !== null);

  const average =
    finalScores.length > 0
      ? finalScores.reduce((total, score) => total + score, 0) / finalScores.length
      : null;

  return (
    <>
      <PageHeader
        title="Sinavlarim"
        description="Acik uclu sorulari yanitlayin; AI on degerlendirmesini aninda gorun."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Aktif sinav" value={publishedExams.length} />
        <StatCard label="Gonderilen cevap" value={MOCK_SUBMISSIONS.length} />
        <StatCard
          label="Ortalama"
          value={average === null ? "-" : formatScore(average)}
          hint="Onaylanmis puanlar dahil"
        />
      </div>

      {openQuestion && openQuestion.rubric ? (
        <Card>
          <CardHeader>
            <CardTitle>{openQuestion.text}</CardTitle>
            <CardDescription>
              {openQuestion.topic} &middot; Acik uclu soru
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnswerForm
              questionId={openQuestion.id}
              questionText={openQuestion.text}
              rubric={openQuestion.rubric}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Gecmis cevaplarim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_SUBMISSIONS.map((submission) => {
            const finalScore =
              submission.instructor_approved_score ?? submission.ai_score;

            return (
              <div key={submission.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SubmissionStatusBadge status={submission.status} />
                  <span className="text-sm font-semibold tabular-nums">
                    {formatScore(finalScore)}
                  </span>
                </div>

                <p className="mt-2 text-sm">{submission.answer_text}</p>

                {submission.ai_feedback ? (
                  <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Geri bildirim: </span>
                    {submission.ai_feedback}
                  </p>
                ) : null}

                {submission.instructor_note ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Egitmen notu: </span>
                    {submission.instructor_note}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-muted-foreground">
                  {formatDateTime(submission.created_at)}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
