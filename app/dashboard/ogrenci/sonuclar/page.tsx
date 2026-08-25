import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Target,
  Trophy,
} from "lucide-react";

import { CourseFeedbackDialog } from "@/components/shared/course-feedback-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  courseFeedbackPeriodKey,
  courseFeedbackScopeKey,
} from "@/lib/course-feedback";
import { getStudentResults } from "@/lib/queries";
import { formatDateTime, formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Sonuçlarım" };

export default async function OgrenciSonuclariPage() {
  const results = await getStudentResults();
  const scores = results
    .map(({ attempt }) => attempt.final_score)
    .filter((score): score is number => score !== null);
  const average =
    scores.length > 0
      ? Math.round(
          (scores.reduce((total, score) => total + score, 0) / scores.length) * 10,
        ) / 10
      : null;
  const best = scores.length > 0 ? Math.max(...scores) : null;
  const feedbackScopeOwners = new Set<string>();
  const feedbackExamIds = new Set<string>();

  for (const { exam, attempt } of results) {
    if (!attempt.completed_at) continue;

    const scope = courseFeedbackScopeKey(
      exam.instructor_id,
      exam.subject ?? "Ders belirtilmemiş",
      courseFeedbackPeriodKey(attempt.completed_at),
    );
    if (feedbackScopeOwners.has(scope)) continue;

    feedbackScopeOwners.add(scope);
    feedbackExamIds.add(exam.id);
  }

  return (
    <>
      <PageHeader
        title="Sonuçlarım"
        description="Yalnızca eğitmen tarafından onaylanmış nihai sınav sonuçları."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Sonuçlanan sınav"
          value={results.length}
          icon={ClipboardCheck}
          accent="cat1"
        />
        <StatCard
          label="Genel ortalama"
          value={average ?? "-"}
          hint="100 üzerinden"
          icon={Target}
          accent="cat2"
        />
        <StatCard
          label="En yüksek puan"
          value={best ?? "-"}
          hint="100 üzerinden"
          icon={Trophy}
          accent="cat3"
        />
      </div>

      {results.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center min-h-[240px]">
            <CheckCircle2 className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">Henüz açıklanan sonucunuz yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eğitmen değerlendirmesi tamamlanan sınavlar burada görünecek.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {results.map(({ exam, attempt, courseFeedback }) => (
            <Card
              key={attempt.id}
              className="overflow-hidden transition-colors hover:border-primary/45"
            >
              <Link
                href={`/dashboard/ogrenci/sinav/${exam.id}`}
                aria-label={`${exam.title} cevap ve geri bildirimlerini incele`}
                className="group block rounded-t-xl outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle>{exam.title}</CardTitle>
                    <div className="flex flex-wrap justify-end gap-2">
                      {attempt.result_viewed_at === null ? (
                        <Badge variant="warning" className="gap-1.5">
                          <BellRing className="h-3.5 w-3.5" />
                          Yeni sonuç
                        </Badge>
                      ) : null}
                      <Badge variant="success" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Eğitmen onaylı
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Nihai puan</p>
                      <p className="mt-1 text-3xl font-semibold tabular">
                        {formatScore(attempt.final_score)}
                      </p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {attempt.earned_points ?? "-"} / {attempt.total_points ?? "-"}{" "}
                      puan
                    </p>
                  </div>
                  <Progress value={attempt.final_score ?? 0} className="h-2" />
                  <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                      Açıklanma: {formatDateTime(attempt.completed_at)}
                    </span>
                    <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5">
                      Cevap ve geri bildirimleri incele
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </CardContent>
              </Link>

              {feedbackExamIds.has(exam.id) ? (
                <CardContent className="border-t bg-muted/10 [&:not(:first-child)]:pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Ders deneyiminiz</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Aynı ders, eğitmen ve dönem için tek değerlendirme alınır.
                        Eğitmen yalnızca anonim toplu sonuçları görür.
                      </p>
                    </div>
                    <CourseFeedbackDialog
                      examId={exam.id}
                      subject={exam.subject}
                      initialFeedback={courseFeedback}
                    />
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
