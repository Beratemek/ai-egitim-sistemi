import { BookOpenCheck, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  GuardianOutcomeStatus,
  GuardianOutcomeView,
} from "@/lib/guardian-analytics";
import { cn } from "@/lib/utils";

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function GuardianOutcomeReport({
  outcomes,
  masteryThreshold,
}: {
  outcomes: GuardianOutcomeView[];
  masteryThreshold: number;
}) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Kazanım karnesi</CardTitle>
          <CardDescription className="mt-1.5">
            Yalnızca sonuçlanmış sınavlardaki eğitmen onaylı ölçümler kullanılır.
          </CardDescription>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Başarı eşiği %{masteryThreshold}
        </Badge>
      </CardHeader>
      <CardContent>
        {outcomes.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
            <BookOpenCheck className="h-8 w-8 text-muted-foreground/45" />
            <p className="mt-4 text-sm font-medium">Kazanım ölçümü henüz oluşmadı</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
              Eğitmen onaylı sonuçlar geldikçe güçlü alanlar ve destek alanları burada
              kanıt düzeyiyle birlikte görünecek.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {outcomes.map((outcome) => (
              <article
                key={outcome.outcome_id}
                className={cn(
                  "space-y-3 rounded-xl border bg-muted/10 p-4",
                  outcome.status === "support_needed" &&
                    "border-destructive/25 bg-destructive/[0.025]",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">
                      {outcome.outcome_text}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {outcome.subject || "Ders belirtilmemiş"} · {outcome.topic}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {outcome.average_score === null
                      ? "—"
                      : `%${scoreFormatter.format(outcome.average_score)}`}
                  </span>
                </div>

                <Progress
                  value={outcome.average_score ?? 0}
                  className="h-1.5"
                  indicatorClassName={progressColor(outcome.status)}
                  aria-label={`${outcome.outcome_text} kazanım puanı`}
                  aria-valuetext={
                    outcome.average_score === null
                      ? "Henüz ölçülmedi"
                      : `Yüzde ${scoreFormatter.format(outcome.average_score)}`
                  }
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <OutcomeStatusBadge status={outcome.status} />
                  <EvidenceBadge level={outcome.evidenceLevel} />
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  {outcome.approved_answer_count} onaylı yanıt · {outcome.measured_question_count}{" "}
                  farklı soru · {outcome.exam_count} sınav
                </p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutcomeStatusBadge({ status }: { status: GuardianOutcomeStatus }) {
  if (status === "support_needed") {
    return <Badge variant="danger">Destek alanı</Badge>;
  }
  if (status === "early_signal") {
    return <Badge variant="warning">Erken sinyal · kesin değil</Badge>;
  }
  if (status === "on_track") {
    return <Badge variant="success">Beklenen düzeyde</Badge>;
  }
  return <Badge variant="soft">Ölçülmedi</Badge>;
}

function EvidenceBadge({
  level,
}: {
  level: GuardianOutcomeView["evidenceLevel"];
}) {
  if (level === "strong") return <Badge variant="outline">Güçlü kanıt</Badge>;
  if (level === "supported") return <Badge variant="outline">Destekli bulgu</Badge>;
  if (level === "early") return <Badge variant="outline">Erken kanıt</Badge>;
  return <Badge variant="outline">Kanıt yok</Badge>;
}

function progressColor(status: GuardianOutcomeStatus): string {
  if (status === "support_needed") return "bg-destructive";
  if (status === "early_signal") return "bg-warning";
  if (status === "on_track") return "bg-success";
  return "bg-muted-foreground/40";
}
