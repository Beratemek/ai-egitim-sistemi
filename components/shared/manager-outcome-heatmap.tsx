"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleHelp, SearchCheck, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ManagerOutcomeSummary } from "@/lib/manager-analytics";
import type {
  OutcomeEvidenceLevel,
  OutcomeGroupDiagnostic,
} from "@/lib/outcome-diagnostics";

type MatrixMode = "classrooms" | "students";

export function ManagerOutcomeHeatmap({
  outcomes,
  mode,
  query = "",
}: {
  outcomes: readonly ManagerOutcomeSummary[];
  mode: MatrixMode;
  query?: string;
}) {
  const visibleOutcomes = React.useMemo(
    () =>
      outcomes
        .filter((outcome) => outcome[mode].length > 0)
        .sort(
          (a, b) =>
            Number(b.isActionableWeak) - Number(a.isActionableWeak) ||
            (a.averageScore ?? Number.POSITIVE_INFINITY) -
              (b.averageScore ?? Number.POSITIVE_INFINITY),
        )
        .slice(0, 12),
    [mode, outcomes],
  );
  const rows = React.useMemo(() => {
    const groups = new Map<string, string>();
    for (const outcome of visibleOutcomes) {
      for (const cell of outcome[mode]) groups.set(cell.groupId, cell.label);
    }
    return [...groups.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [mode, visibleOutcomes]);
  const firstSelection = React.useMemo(
    () => findInitialSelection(visibleOutcomes, mode),
    [mode, visibleOutcomes],
  );
  const [selectionKey, setSelectionKey] = React.useState(firstSelection);
  const selection = findSelection(visibleOutcomes, mode, selectionKey) ??
    findSelection(visibleOutcomes, mode, firstSelection);

  return (
    <Card className="manager-outcome-heatmap overflow-hidden">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {mode === "classrooms" ? "Sınıf × kazanım ısı haritası" : "Öğrenci × kazanım ısı haritası"}
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-3xl">
              Hücreye dokunarak puanın hangi soru ve hata örüntülerinden oluştuğunu inceleyin.
              İlk 12 öncelikli kazanım gösterilir.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground" aria-label="Isı haritası açıklaması">
            <Legend tone="good" label="Eşik üstü" />
            <Legend tone="watch" label="İzlenmeli" />
            <Legend tone="risk" label="Müdahale" />
            <Legend tone="early" label="Erken sinyal" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-0 sm:px-6">
        {visibleOutcomes.length === 0 || rows.length === 0 ? (
          <div className="mx-4 flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed text-center sm:mx-0">
            <Target className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Isı haritası için ölçüm oluşmadı</p>
            <p className="mt-1 max-w-md px-4 text-xs text-muted-foreground">
              Sonuçlanmış sınavlarda en az bir eğitmen onaylı yanıt oluştuğunda hücreler görünür.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-y sm:rounded-xl sm:border">
              <table className="min-w-max border-separate border-spacing-0 text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 min-w-44 border-b border-r bg-card px-3 py-3 text-left font-semibold">
                      {mode === "classrooms" ? "Sınıf" : "Öğrenci"}
                    </th>
                    {visibleOutcomes.map((outcome, index) => (
                      <th
                        key={outcome.outcomeId}
                        className="w-24 max-w-24 border-b border-r bg-muted/20 px-2 py-3 text-left align-bottom last:border-r-0"
                        title={outcome.outcomeText}
                      >
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          K{index + 1}
                        </span>
                        <span className="mt-1 block line-clamp-3 leading-snug">
                          {outcome.outcomeText}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th className="sticky left-0 z-10 border-b border-r bg-card px-3 py-2.5 text-left font-medium last:border-b-0">
                        <Link
                          href={`${rowHref(mode, row.id)}${query}`}
                          className="group flex items-center justify-between gap-2 hover:text-primary"
                        >
                          <span className="max-w-36 truncate">{row.label}</span>
                          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </th>
                      {visibleOutcomes.map((outcome) => {
                        const cell = outcome[mode].find((item) => item.groupId === row.id);
                        const key = selectionId(outcome.outcomeId, row.id);
                        return (
                          <td key={outcome.outcomeId} className="border-b border-r p-1.5 text-center last:border-r-0">
                            {cell ? (
                              <button
                                type="button"
                                onClick={() => setSelectionKey(key)}
                                aria-pressed={selection?.key === key}
                                aria-label={`${row.label}, ${outcome.outcomeText}: ${cell.averageScore === null ? "ölçülmedi" : `%${cell.averageScore}`}`}
                                title={`${cell.answerCount} onaylı yanıt · ${evidenceLabel(cell.evidenceLevel)}`}
                                className={cn(
                                  "mx-auto flex h-12 w-[68px] items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  heatClass(cell),
                                  selection?.key === key && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-card",
                                )}
                              >
                                {cell.averageScore === null ? "—" : `%${cell.averageScore}`}
                              </button>
                            ) : (
                              <span className="mx-auto flex h-12 w-[68px] items-center justify-center rounded-lg border border-dashed text-muted-foreground/50">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selection ? (
              <DiagnosisDetail outcome={selection.outcome} cell={selection.cell} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DiagnosisDetail({
  outcome,
  cell,
}: {
  outcome: ManagerOutcomeSummary;
  cell: OutcomeGroupDiagnostic;
}) {
  return (
    <div className="mx-4 grid gap-4 rounded-xl border bg-muted/15 p-4 sm:mx-0 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge level={cell.evidenceLevel} />
          {cell.isActionableWeak ? <Badge variant="danger">Müdahale önerilir</Badge> : null}
          {cell.pendingCount > 0 ? <Badge variant="warning">{cell.pendingCount} onay bekliyor</Badge> : null}
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {cell.label} · {outcome.subject} / {outcome.topic}
        </p>
        <h3 className="mt-1 font-display text-lg leading-snug">{outcome.outcomeText}</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
          <Metric label="Başarı" value={cell.averageScore === null ? "—" : `%${cell.averageScore}`} />
          <Metric label="Kanıt" value={`${cell.answerCount} yanıt`} />
          <Metric label="Kapsam" value={`${cell.measuredQuestionCount} soru`} />
          <Metric label="Ölçüm" value={`${cell.examCount} sınav`} />
        </div>
        {cell.excludedEvidenceCount > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
            <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {cell.excludedEvidenceCount} kayıt, sınav tamamlanmadığı veya soru-puan bağı bulunamadığı için puana katılmadı.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SearchCheck className="h-4 w-4 text-primary" />
          Kanıtı oluşturan sorular
        </p>
        {cell.questions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Henüz ayrıntılandırılabilir tamamlanmış soru kanıtı yok.
          </p>
        ) : (
          cell.questions.slice(0, 4).map((question, index) => (
            <div key={question.questionId} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm font-medium">
                  {index + 1}. {question.questionText}
                </p>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {question.averageScore === null ? "—" : `%${question.averageScore}`}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {question.successfulCount} yeterli · {question.needsWorkCount} geliştirilmeli · {question.blankCount} boş
              </p>
              {question.wrongAnswers[0] ? (
                <p className="mt-2 rounded-md bg-destructive/5 px-2.5 py-2 text-xs text-foreground">
                  Sık hata örüntüsü: <strong>{question.wrongAnswers[0].answer}</strong>
                  {question.wrongAnswers[0].optionText ? ` · ${question.wrongAnswers[0].optionText}` : ""}
                  {` (${question.wrongAnswers[0].count} kez)`}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function EvidenceBadge({ level }: { level: OutcomeEvidenceLevel }) {
  return (
    <Badge variant={level === "strong" ? "success" : level === "supported" ? "soft" : "warning"}>
      {evidenceLabel(level)}
    </Badge>
  );
}

function Legend({ tone, label }: { tone: "good" | "watch" | "risk" | "early"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-sm border",
          tone === "good" && "border-success/40 bg-success/20",
          tone === "watch" && "border-warning/40 bg-warning/20",
          tone === "risk" && "border-destructive/40 bg-destructive/20",
          tone === "early" && "border-dashed border-warning/60 bg-warning/5",
        )}
      />
      {label}
    </span>
  );
}

function heatClass(cell: OutcomeGroupDiagnostic): string {
  if (cell.evidenceLevel === "early") {
    return "border-dashed border-warning/60 bg-warning/10 text-warning";
  }
  if (cell.isActionableWeak) {
    return "border-destructive/40 bg-destructive/15 text-destructive";
  }
  if (cell.averageScore !== null && cell.averageScore < 75) {
    return "border-warning/40 bg-warning/15 text-warning";
  }
  return "border-success/40 bg-success/15 text-success";
}

function evidenceLabel(level: OutcomeEvidenceLevel): string {
  if (level === "strong") return "Güçlü kanıt";
  if (level === "supported") return "Destekli bulgu";
  if (level === "early") return "Erken sinyal";
  return "Ölçülmedi";
}

function findInitialSelection(
  outcomes: readonly ManagerOutcomeSummary[],
  mode: MatrixMode,
): string {
  for (const outcome of outcomes) {
    const cell = outcome[mode].find((item) => item.isActionableWeak) ?? outcome[mode][0];
    if (cell) return selectionId(outcome.outcomeId, cell.groupId);
  }
  return "";
}

function findSelection(
  outcomes: readonly ManagerOutcomeSummary[],
  mode: MatrixMode,
  key: string,
): { key: string; outcome: ManagerOutcomeSummary; cell: OutcomeGroupDiagnostic } | null {
  for (const outcome of outcomes) {
    const cell = outcome[mode].find(
      (item) => selectionId(outcome.outcomeId, item.groupId) === key,
    );
    if (cell) return { key, outcome, cell };
  }
  return null;
}

function selectionId(outcomeId: string, groupId: string): string {
  return `${outcomeId}\u0000${groupId}`;
}

function rowHref(mode: MatrixMode, groupId: string): string {
  return mode === "classrooms"
    ? `/dashboard/yonetici/siniflar/${encodeURIComponent(groupId)}`
    : `/dashboard/yonetici/ogrenciler/${encodeURIComponent(groupId)}`;
}
