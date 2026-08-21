import type { Metadata } from "next";
import {
  BookOpenCheck,
  CircleAlert,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getStudentGrowth } from "@/lib/queries";
import { buildStudyRecommendations } from "@/lib/student-recommendations";

export const metadata: Metadata = { title: "Gelisimim" };

export default async function OgrenciGelisimPage() {
  const topics = await getStudentGrowth();
  const totalAnswers = topics.reduce(
    (total, topic) => total + topic.approvedAnswerCount,
    0,
  );
  const weightedAverage =
    totalAnswers > 0
      ? Math.round(
          (topics.reduce(
            (total, topic) => total + topic.averageScore * topic.approvedAnswerCount,
            0,
          ) /
            totalAnswers) *
            10,
        ) / 10
      : null;
  const strongest = topics[0] ?? null;
  const needsWork = [...topics].sort((a, b) => a.averageScore - b.averageScore)[0] ?? null;
  const outcomeCoverage = topics.filter((topic) => topic.outcomeId !== null).length;
  const recommendations = buildStudyRecommendations(topics);

  return (
    <>
      <PageHeader
        title="Gelisimim"
        description="Egitmen onayli cevaplarinizdan hesaplanan kazanim bazli ilerleme."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Onayli cevap"
          value={totalAnswers}
          icon={BookOpenCheck}
          accent="primary"
        />
        <StatCard
          label="Basari ortalamasi"
          value={weightedAverage ?? "-"}
          hint="100 uzerinden"
          icon={Target}
          accent="success"
        />
        <StatCard
          label="Degerlendirilen kazanim"
          value={topics.length}
          hint={`${outcomeCoverage} tanesi kazanimla eslesmis`}
          icon={TrendingUp}
        />
      </div>

      {topics.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <TrendingUp className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">Gelisiminiz henuz hesaplanamiyor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Egitmen onayli sonuclar geldikce kazanim bazli analiz burada olusacak.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Sana ozel calisma plani
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {recommendations.map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="space-y-3 rounded-xl border bg-muted/20 p-4"
                >
                  <Badge
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
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Konu bazli basari</CardTitle>
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
                        {topic.outcomeId ? "" : " · Kazanim eslesmesi yok"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular">
                      {topic.averageScore} / 100
                    </span>
                  </div>
                  <Progress value={topic.averageScore} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {topic.approvedAnswerCount} onayli cevap
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {strongest ? (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <Badge variant="success">Guclu alan</Badge>
                  <div>
                    <p className="font-semibold">
                      {strongest.outcomeText ?? strongest.topic}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {strongest.averageScore} ortalama ile en yuksek performansiniz.
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
                    Gelistirilebilir alan
                  </Badge>
                  <div>
                    <p className="font-semibold">
                      {needsWork.outcomeText ?? needsWork.topic}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Bu konuda tekrar ve ek calisma performansiniza katkida bulunabilir.
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
