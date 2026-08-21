import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, Target, Trophy } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

  return (
    <>
      <PageHeader
        title="Sonuclarim"
        description="Yalnızca eğitmen tarafından onaylanmış nihai sınav sonuçları."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Sonuçlanan sınav" value={results.length} icon={ClipboardCheck} />
        <StatCard
          label="Genel ortalama"
          value={average ?? "-"}
          hint="100 üzerinden"
          icon={Target}
          accent="success"
        />
        <StatCard
          label="En yüksek puan"
          value={best ?? "-"}
          hint="100 üzerinden"
          icon={Trophy}
          accent="primary"
        />
      </div>

      {results.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium">Henuz aciklanan sonucunuz yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Eğitmen değerlendirmesi tamamlanan sınavlar burada gorunecek.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {results.map(({ exam, attempt }) => (
            <Card key={attempt.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{exam.title}</CardTitle>
                  <Badge variant="success" className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Eğitmen onaylı
                  </Badge>
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
                    {attempt.earned_points ?? "-"} / {attempt.total_points ?? "-"} puan
                  </p>
                </div>
                <Progress value={attempt.final_score ?? 0} className="h-2" />
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Aciklanma: {formatDateTime(attempt.completed_at)}
                  </span>
                  <Link
                    href={`/dashboard/öğrenci/sınav/${exam.id}`}
                    className="flex items-center gap-1 font-medium text-primary"
                  >
                    Cevap ve geri bildirimler
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
