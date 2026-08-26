"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExamAiReviewResult } from "@/lib/ai";
import type { ExamQualityIssue, ExamQualityReport } from "@/lib/exam-quality";
import type { ApiResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ExamQualityPanel({
  examId,
  report,
  questionNumbers,
  canPersist = true,
}: {
  examId: string;
  report: ExamQualityReport;
  questionNumbers: Readonly<Record<string, number>>;
  canPersist?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [review, setReview] = React.useState<ExamAiReviewResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function requestReview() {
    if (!canPersist) {
      toast.error("AI incelemesi tanıtım modunda kullanılamaz.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/review-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId }),
      });
      const payload = (await response.json()) as ApiResponse<ExamAiReviewResult>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "AI incelemesi tamamlanamadı." : payload.error);
      }
      setReview(payload.data);
      toast.success("AI kalite incelemesi hazırlandı");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "AI incelemesi tamamlanamadı.";
      setError(message);
      toast.error("AI kalite incelemesi tamamlanamadı", { description: message });
    } finally {
      setPending(false);
    }
  }

  const statusMeta =
    report.status === "blocker"
      ? {
          label: "Yayın engelleri var",
          description: "Kırmızı kontroller kapanmadan sınav yayımlanamaz.",
          icon: CircleAlert,
          className: "border-destructive/30 bg-destructive/5 text-destructive",
          variant: "danger" as const,
        }
      : report.status === "warning"
        ? {
            label: "Yayıma hazır, uyarılar var",
            description: "Uyarılar kararı engellemez; bilinçli olarak gözden geçirin.",
            icon: AlertTriangle,
            className: "border-warning/30 bg-warning/5 text-warning",
            variant: "warning" as const,
          }
        : {
            label: "Deterministik kontroller temiz",
            description: "Sınav biçim ve veri kurallarına göre yayıma hazır.",
            icon: CheckCircle2,
            className: "border-success/30 bg-success/5 text-success",
            variant: "success" as const,
          };
  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-5">
      <Card className={cn("overflow-hidden", statusMeta.className)}>
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/80">
              <StatusIcon className="h-5 w-5" />
            </span>
            <div>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                {statusMeta.description}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Soru" value={report.metrics.questionCount} />
            <Metric label="Toplam" value={report.metrics.totalPoints} />
            <Metric label="Kazanım" value={`%${report.metrics.outcomeCoveragePercent}`} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <IssueList
          title="Yayın engelleri"
          description="Sunucu yayına alma anında bu kuralları yeniden doğrular."
          issues={report.blockers}
          questionNumbers={questionNumbers}
          empty="Zorunlu kontrollerde sorun yok."
          severity="blocker"
        />
        <IssueList
          title="İyileştirme uyarıları"
          description="Pedagojik kalite sinyalleridir; yayını tek başına engellemez."
          issues={report.warnings}
          questionNumbers={questionNumbers}
          empty="Deterministik kalite uyarısı bulunmuyor."
          severity="warning"
        />
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BrainCircuit className="h-4 w-4" />
              </span>
              <CardTitle>AI pedagojik inceleme</CardTitle>
            </div>
            <CardDescription className="mt-2 max-w-2xl leading-relaxed">
              Kapsam, bilişsel çeşitlilik, ifade açıklığı ve çeldirici kalitesi
              için danışman görüşü üretir. Deterministik yayın kurallarının ve
              eğitmen kararının yerine geçmez.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={review ? "outline" : "default"}
            disabled={pending || report.metrics.resolvedQuestionCount === 0}
            onClick={() => void requestReview()}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {pending ? "İnceleniyor…" : review ? "Yeniden incele" : "AI ile incele"}
          </Button>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {review ? <AiReview review={review} /> : (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              İnceleme isteğe bağlıdır. Sınav soruları dışında öğrenci veya cevap verisi modele gönderilmez.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/15 p-4 text-sm">
        <p className="text-muted-foreground">
          Bulgulardaki soru numaraları, sınavdaki güncel sırayı gösterir.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/egitmen/soru-havuzu">Soru havuzunu aç</Link>
        </Button>
      </div>
    </div>
  );
}

function IssueList({
  title,
  description,
  issues,
  questionNumbers,
  empty,
  severity,
}: {
  title: string;
  description: string;
  issues: readonly ExamQualityIssue[];
  questionNumbers: Readonly<Record<string, number>>;
  empty: string;
  severity: "blocker" | "warning";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            {empty}
          </div>
        ) : issues.map((issue) => {
          const numbers = issue.questionIds
            .map((id) => questionNumbers[id])
            .filter((value): value is number => value !== undefined)
            .sort((a, b) => a - b);
          return (
            <div
              key={issue.code}
              className={cn(
                "rounded-xl border p-4",
                severity === "blocker"
                  ? "border-destructive/25 bg-destructive/5"
                  : "border-warning/25 bg-warning/5",
              )}
            >
              <div className="flex items-start gap-2">
                {severity === "blocker" ? (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                )}
                <div>
                  <p className="text-sm font-semibold">{issue.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {issue.message}
                  </p>
                  {numbers.length > 0 ? (
                    <p className="mt-2 text-xs font-medium">Sorular: {numbers.join(", ")}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AiReview({ review }: { review: ExamAiReviewResult }) {
  return (
    <div className="space-y-5">
      <p className="rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
        {review.summary}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-success/25 bg-success/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
            <ShieldCheck className="h-4 w-4" /> Güçlü yönler
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {review.strengths.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>
        <section className="rounded-xl border p-4">
          <h3 className="text-sm font-semibold">Revizyon öncelikleri</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {review.revisionPriorities.map((item, index) => (
              <li key={item} className="flex gap-2">
                <span className="font-semibold text-primary">{index + 1}.</span>{item}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {review.risks.length > 0 ? (
        <div className="space-y-3">
          {review.risks.map((risk, index) => (
            <section key={`${risk.title}-${index}`} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={risk.severity === "yuksek" ? "danger" : risk.severity === "orta" ? "warning" : "outline"}>
                  {risk.severity === "yuksek" ? "Yüksek" : risk.severity === "orta" ? "Orta" : "Düşük"}
                </Badge>
                <h3 className="text-sm font-semibold">{risk.title}</h3>
                {risk.questionNumbers.length > 0 ? (
                  <span className="text-xs text-muted-foreground">Sorular: {risk.questionNumbers.join(", ")}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{risk.explanation}</p>
              <p className="mt-2 text-sm"><strong>Öneri:</strong> {risk.recommendation}</p>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-20 rounded-xl border border-current/10 bg-background/75 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
