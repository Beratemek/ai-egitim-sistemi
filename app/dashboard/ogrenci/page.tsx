import type { Metadata } from "next";
import { CalendarClock, FileText, Target } from "lucide-react";

import { AnswerForm } from "@/components/shared/answer-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  QuestionTypeBadge,
  SubmissionStatusBadge,
} from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getExams, getQuestions, getSubmissions } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Ogrenci" };

export default async function OgrenciPage() {
  const [exams, questions, submissions] = await Promise.all([
    getExams(),
    getQuestions(),
    getSubmissions(),
  ]);

  const publishedExams = exams.filter((exam) => exam.is_published);

  // Demo: onaylanmis ilk acik uclu soru uzerinden cevap akisini gosteriyoruz.
  const openQuestion = questions.find(
    (question) => question.type === "acik_uclu" && question.status === "onayli",
  );

  const finalScores = submissions.map(
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
        <StatCard
          label="Aktif sinav"
          value={publishedExams.length}
          icon={CalendarClock}
          accent="primary"
        />
        <StatCard
          label="Gonderilen cevap"
          value={submissions.length}
          icon={FileText}
        />
        <StatCard
          label="Ortalama"
          value={average === null ? "-" : Math.round(average * 10) / 10}
          hint="100 uzerinden"
          icon={Target}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ---------- Aktif soru ---------- */}
        <div className="lg:col-span-3">
          {openQuestion && openQuestion.rubric ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <QuestionTypeBadge type={openQuestion.type} />
                  <Badge variant="soft">{openQuestion.topic}</Badge>
                </div>
                <CardTitle className="mt-2 leading-snug">{openQuestion.text}</CardTitle>
                <CardDescription>
                  Cevabiniz rubrige gore degerlendirilecek. Nihai puani egitmen onaylar.
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
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Su an yanitlanacak acik uclu soru yok.
              </CardContent>
            </Card>
          )}
        </div>

        {/* ---------- Gecmis cevaplar ---------- */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Gecmis cevaplarim
          </h2>

          {submissions.map((submission) => {
            const finalScore =
              submission.instructor_approved_score ?? submission.ai_score;

            return (
              <Card key={submission.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SubmissionStatusBadge status={submission.status} />
                    <span className="text-sm font-semibold tabular">
                      {finalScore === null ? "-" : `${finalScore} / 100`}
                    </span>
                  </div>

                  {finalScore !== null ? (
                    <Progress value={finalScore} className="h-1.5" />
                  ) : null}

                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {submission.answer_text}
                  </p>

                  {submission.ai_feedback ? (
                    <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Geri bildirim: </span>
                      {submission.ai_feedback}
                    </p>
                  ) : null}

                  {submission.instructor_note ? (
                    <p className="rounded-lg bg-success/10 px-3 py-2 text-xs leading-relaxed text-success">
                      <span className="font-medium">Egitmen notu: </span>
                      {submission.instructor_note}
                    </p>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(submission.created_at)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
