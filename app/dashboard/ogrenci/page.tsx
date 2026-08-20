import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  Target,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getStudentExams, getSubmissions } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Ogrenci" };

export default async function OgrenciPage() {
  const [exams, submissions] = await Promise.all([
    getStudentExams(),
    getSubmissions(),
  ]);

  const finalScores = submissions
    .map((submission) => submission.instructor_approved_score ?? submission.ai_score)
    .filter((score): score is number => score !== null);

  const average =
    finalScores.length > 0
      ? finalScores.reduce((total, score) => total + score, 0) / finalScores.length
      : null;

  return (
    <>
      <PageHeader
        title="Sinavlarim"
        description="Yayindaki sinavlara girin; AI on degerlendirmesini aninda gorun."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Aktif sinav"
          value={exams.length}
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
        {/* ---------- Yayindaki sinavlar ---------- */}
        <div className="space-y-4 lg:col-span-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Girebileceginiz sinavlar
          </h2>

          {exams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Su an yayinda sinav yok. Egitmeniniz sinavi yayina aldiginda burada
                gorunecek.
              </CardContent>
            </Card>
          ) : (
            exams.map((exam) => {
              const isComplete =
                exam.questionCount > 0 && exam.answeredCount >= exam.questionCount;

              return (
                <Link
                  key={exam.id}
                  href={`/dashboard/ogrenci/sinav/${exam.id}`}
                  className="group block"
                >
                  <Card className="transition-all group-hover:border-primary/50 group-hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="leading-snug">{exam.title}</CardTitle>
                        {isComplete ? (
                          <Badge variant="success" className="gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Tamamlandi
                          </Badge>
                        ) : (
                          <Badge variant="warning">Devam ediyor</Badge>
                        )}
                      </div>
                      {exam.description ? (
                        <CardDescription>{exam.description}</CardDescription>
                      ) : null}
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted-foreground">Yanitlanan</span>
                          <span className="font-semibold tabular">
                            {exam.answeredCount} / {exam.questionCount}
                          </span>
                        </div>
                        <Progress
                          value={
                            exam.questionCount > 0
                              ? (exam.answeredCount / exam.questionCount) * 100
                              : 0
                          }
                          className="h-1.5"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {exam.ends_at
                            ? `Bitis: ${formatDateTime(exam.ends_at)}`
                            : "Sure siniri yok"}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary">
                          {isComplete ? "Sonuclari gor" : "Sinava gir"}
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {/* ---------- Gecmis cevaplar ---------- */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Gecmis cevaplarim
          </h2>

          {submissions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Henuz cevap gondermediniz.
              </CardContent>
            </Card>
          ) : (
            submissions.map((submission) => {
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
                        <span className="font-medium text-foreground">
                          Geri bildirim:{" "}
                        </span>
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
            })
          )}
        </div>
      </div>
    </>
  );
}
