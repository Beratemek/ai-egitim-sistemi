import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CircleAlert,
  History,
  ListChecks,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  StudentGrowthChart,
  type StudentGrowthPoint,
} from "@/components/shared/student-growth-chart";
import { StudentRecommendationActions } from "@/components/shared/student-recommendation-actions";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getStudentGrowth, getStudentResults } from "@/lib/queries";
import {
  asPercentageScore,
  calculatePointWeightedAverage,
  scoreDifference,
} from "@/lib/student-growth";
import { buildStudyRecommendations } from "@/lib/student-recommendations";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Gelişimim" };

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export default async function OgrenciGelisimPage() {
  const [topics, results] = await Promise.all([
    getStudentGrowth(),
    getStudentResults(),
  ]);

  const totalAnswers = topics.reduce(
    (total, topic) => total + topic.approvedAnswerCount,
    0,
  );
  const weightedAverage = calculatePointWeightedAverage(
    results.map(({ attempt }) => attempt),
  );
  const strongest = topics[0] ?? null;
  const needsWork = [...topics].sort((a, b) => a.averageScore - b.averageScore)[0] ?? null;
  const outcomeCoverage = topics.filter((topic) => topic.outcomeId !== null).length;
  const unmatchedTopicCount = topics.length - outcomeCoverage;
  const recommendations = buildStudyRecommendations(topics);

  const timeline: StudentGrowthPoint[] = results
    .map(({ exam, attempt }) => {
      const score = asPercentageScore(attempt.final_score);
      if (score === null || !attempt.completed_at) return null;
      return {
        attemptId: attempt.id,
        examId: exam.id,
        title: exam.title,
        subject: exam.subject ?? "Ders belirtilmemiş",
        completedAt: attempt.completed_at,
        score,
      };
    })
    .filter((point): point is StudentGrowthPoint => point !== null)
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    );

  const latestResult = timeline.at(-1) ?? null;
  const previousResult = timeline.at(-2) ?? null;
  const latestChange = scoreDifference(latestResult?.score, previousResult?.score);
  const mostImproved = [...topics]
    .filter((topic) => topic.scoreChange !== null && topic.scoreChange > 0)
    .sort((a, b) => (b.scoreChange ?? 0) - (a.scoreChange ?? 0))[0] ?? null;

  return (
    <>
      <PageHeader
        title="Gelişimim"
        description="Eğitmen onaylı sonuçlarından hesaplanan kazanım ve konu bazlı ilerleme."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Onaylanmış soru yanıtı"
          value={totalAnswers}
          hint="Tamamlanan sınavlardan"
          icon={BookOpenCheck}
          accent="primary"
        />
        <StatCard
          label="Puan ağırlıklı ortalama"
          value={weightedAverage ?? "-"}
          hint="Kazanılan / toplam puan · 100 üzerinden"
          icon={Target}
          accent="success"
        />
        <StatCard
          label="Değerlendirilen kazanım"
          value={outcomeCoverage}
          hint={
            unmatchedTopicCount > 0
              ? `${unmatchedTopicCount} konu henüz kazanımla eşleşmemiş`
              : "Tüm alanlar kazanımla eşleşmiş"
          }
          icon={TrendingUp}
        />
      </div>

      {topics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <TrendingUp className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">Gelişimin henüz hesaplanamıyor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eğitmen onaylı sonuçlar geldikçe kazanım analizin burada oluşacak.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <StudentGrowthChart points={timeline} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Uygulanabilir çalışma önerileri
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Öncelikli kazanımları planına ekle veya ilgili sınavdaki eğitmen geri bildirimine git.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4"
                >
                  <Badge
                    className="w-fit"
                    variant={
                      recommendation.priority === "yuksek"
                        ? "danger"
                        : recommendation.priority === "orta"
                          ? "warning"
                          : "success"
                    }
                  >
                    {recommendation.priorityLabel}
                  </Badge>
                  <div>
                    <p className="text-sm font-semibold">{recommendation.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recommendation.context}
                    </p>
                  </div>
                  <p className="flex items-start gap-2 text-sm leading-relaxed">
                    <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {recommendation.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Dayanak: {recommendation.evidence}
                  </p>
                  <div className="mt-auto">
                    <StudentRecommendationActions
                      id={recommendation.id}
                      title={recommendation.title}
                      context={recommendation.context}
                      action={recommendation.action}
                      evidence={recommendation.evidence}
                      outcomeId={recommendation.outcomeId}
                      latestExamId={recommendation.latestExamId}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Sonuç karşılaştırması
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Son sınavını, önceki sonucunu ve kazanım hareketlerini birlikte gör.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard
                label="Son sınav"
                title={latestResult?.title ?? "Henüz sonuç yok"}
                detail={
                  latestResult
                    ? `${scoreFormatter.format(latestResult.score)} / 100 · ${formatDateTime(latestResult.completedAt)}`
                    : "Eğitmen onaylı ilk sonuç bekleniyor."
                }
                href={
                  latestResult
                    ? `/dashboard/ogrenci/sinav/${latestResult.examId}`
                    : undefined
                }
              />
              <InsightCard
                label="Önceki sınava göre"
                title={
                  latestChange === null
                    ? "Karşılaştırma bekleniyor"
                    : `${latestChange > 0 ? "+" : ""}${scoreFormatter.format(latestChange)} puan`
                }
                detail={
                  previousResult
                    ? `${previousResult.title}: ${scoreFormatter.format(previousResult.score)} / 100`
                    : "İkinci tamamlanmış sınavdan sonra hesaplanır."
                }
                tone={latestChange === null ? "neutral" : latestChange >= 0 ? "positive" : "negative"}
              />
              <InsightCard
                label="En çok gelişen kazanım"
                title={
                  mostImproved?.outcomeText ??
                  mostImproved?.topic ??
                  "Karşılaştırılabilir kazanım yok"
                }
                detail={
                  mostImproved?.scoreChange
                    ? `İlk ölçüme göre +${scoreFormatter.format(mostImproved.scoreChange)} puan`
                    : "Aynı kazanımın birden fazla sınavda ölçülmesi gerekir."
                }
                tone={mostImproved ? "positive" : "neutral"}
              />
              <InsightCard
                label="Düzenli tekrar alanı"
                title={needsWork?.outcomeText ?? needsWork?.topic ?? "Henüz belirlenmedi"}
                detail={
                  needsWork
                    ? `${scoreFormatter.format(needsWork.averageScore)} / 100 · çalışma planında önceliklendirildi`
                    : "Onaylı sonuç geldiğinde öneri oluşturulur."
                }
                tone="negative"
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Kazanım ve konu bazlı gelişim</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {topics.map((topic) => (
                  <div
                    key={topic.outcomeId ?? `${topic.subject}-${topic.topic}`}
                    className="space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {topic.outcomeText ?? topic.topic}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {topic.subject} · {topic.topic}
                          {topic.outcomeId ? "" : " · Kazanım eşleşmesi yok"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {scoreFormatter.format(topic.averageScore)} / 100
                      </span>
                    </div>
                    <Progress value={topic.averageScore} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {topic.approvedAnswerCount} onaylanmış soru yanıtı
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-2">
              {strongest ? (
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <Badge variant="success">En iyi olduğun alan</Badge>
                    <div>
                      <p className="font-semibold">
                        {strongest.outcomeText ?? strongest.topic}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {scoreFormatter.format(strongest.averageScore)} / 100 ile en yüksek mevcut performansın.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {needsWork ? (
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <Badge variant="warning" className="gap-1.5">
                      <CircleAlert className="h-3.5 w-3.5" />
                      Geliştirilebilir alan
                    </Badge>
                    <div>
                      <p className="font-semibold">
                        {needsWork.outcomeText ?? needsWork.topic}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Bu alan çalışma planına öncelikli tekrar olarak eklendi.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InsightCard({
  label,
  title,
  detail,
  tone = "neutral",
  href,
}: {
  label: string;
  title: string;
  detail: string;
  tone?: "neutral" | "positive" | "negative";
  href?: string;
}) {
  const Icon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : RefreshCcw;

  return (
    <div className="flex min-h-36 flex-col rounded-xl border bg-muted/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon
          className={`h-4 w-4 ${
            tone === "positive"
              ? "text-primary"
              : tone === "negative"
                ? "text-warning"
                : "text-muted-foreground"
          }`}
        />
      </div>
      <p className="mt-4 font-semibold leading-snug">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      {href ? (
        <Link
          href={href}
          className="mt-auto flex items-center gap-1 pt-4 text-xs font-semibold text-primary"
        >
          Sonucu incele
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
