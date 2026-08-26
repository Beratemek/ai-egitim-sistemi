"use client";

import * as React from "react";
import { AlertTriangle, BarChart3, Search, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  InstructorQuestionAnalyticsRow,
  QuestionAnalyticsWarning,
} from "@/lib/question-analytics";

export function InstructorQuestionAnalyticsDashboard({
  questions,
}: {
  questions: readonly InstructorQuestionAnalyticsRow[];
}) {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(questions[0]?.questionId ?? "");
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visible = questions.filter((question) =>
    !normalizedQuery ||
    `${question.text} ${question.subject} ${question.topic} ${question.outcomeText ?? ""}`
      .toLocaleLowerCase("tr-TR")
      .includes(normalizedQuery),
  );
  const selected =
    visible.find((question) => question.questionId === selectedId) ?? visible[0] ?? null;

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Soru performansı</CardTitle>
            <CardDescription className="mt-1.5">
              Boş oranı tamamlanan deneme fırsatlarından; başarı yalnız nihai öğretmen puanlarından hesaplanır.
            </CardDescription>
          </div>
          <label className="relative block max-w-md">
            <span className="sr-only">Soru ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Soru, ders, konu veya kazanım ara" className="pl-9" />
          </label>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Soru</TableHead>
                <TableHead>Uyarılar</TableHead>
                <TableHead className="text-right">Fırsat</TableHead>
                <TableHead className="text-right">Başarı</TableHead>
                <TableHead className="text-right">Boş</TableHead>
                <TableHead className="text-right">Ayırt edicilik</TableHead>
                <TableHead aria-label="Detay" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground">Aramayla eşleşen soru yok.</TableCell></TableRow>
              ) : visible.map((question) => (
                <TableRow key={question.questionId} data-state={selected?.questionId === question.questionId ? "selected" : undefined}>
                  <TableCell className="min-w-72 max-w-xl">
                    <p className="line-clamp-2 font-medium leading-snug">{question.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {question.subject} · {question.topic} · {question.type === "test" ? "Test" : "Açık uçlu"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-48"><WarningBadges warnings={question.warnings} compact /></TableCell>
                  <TableCell className="text-right tabular-nums">{question.opportunityCount}</TableCell>
                  <TableCell className="min-w-28 text-right">
                    <span className="font-semibold tabular-nums">{question.averageScore === null ? "—" : `%${question.averageScore}`}</span>
                    <Progress value={question.averageScore ?? 0} className="mt-1.5 ml-auto h-1 w-20" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">%{question.blankRate}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {question.discrimination === null ? <span className="text-muted-foreground">—</span> : question.discrimination.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(question.questionId)}>İncele</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-4 pt-3 text-right text-xs text-muted-foreground sm:px-0">{visible.length} / {questions.length} soru</p>
        </CardContent>
      </Card>

      <QuestionDetail question={selected} />
    </div>
  );
}

function QuestionDetail({ question }: { question: InstructorQuestionAnalyticsRow | null }) {
  if (!question) {
    return (
      <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><Target className="h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">İncelenecek soru bulunmuyor</p></CardContent></Card>
    );
  }
  return (
    <Card className="h-fit 2xl:sticky 2xl:top-6">
      <CardHeader>
        <div className="flex flex-wrap gap-2"><Badge variant="soft">{question.type === "test" ? "Test" : "Açık uçlu"}</Badge><Badge variant="outline">{question.difficulty}</Badge></div>
        <CardTitle className="pt-2 font-display text-lg leading-snug">{question.text}</CardTitle>
        <CardDescription>{question.outcomeText ?? "Kazanım eşleşmesi yok"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <DetailMetric label="Başarı" value={question.averageScore === null ? "—" : `%${question.averageScore}`} />
          <DetailMetric label="Boş bırakma" value={`%${question.blankRate}`} />
          <DetailMetric label="AI–öğretmen farkı" value={question.aiTeacherMeanDifference === null ? "—" : `${question.aiTeacherMeanDifference} puan`} />
          <DetailMetric label="Puan revizyonu" value={question.teacherOverrideRate === null ? "—" : `%${question.teacherOverrideRate}`} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning" />Analiz notları</p>
          <WarningBadges warnings={question.warnings} />
        </div>

        {question.optionStatistics.length > 0 ? (
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-primary" />Seçenek dağılımı</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Oranlar boş bırakılanlar hariç, işaretlenen test yanıtları içindedir.
            </p>
            <div className="space-y-3">
              {question.optionStatistics.map((option) => (
                <div key={option.key}>
                  <div className="flex items-start justify-between gap-3 text-xs">
                    <p className="min-w-0"><strong>{option.key}</strong> · <span className="text-muted-foreground">{option.text}</span>{option.correct ? <Badge variant="success" className="ml-2">Anahtar</Badge> : null}</p>
                    <span className="shrink-0 font-medium tabular-nums">{option.count} · %{option.rate}</span>
                  </div>
                  <Progress value={option.rate} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Kullanıldığı sınavlar</p>
          <p className="mt-1 leading-relaxed">{question.examTitles.join(", ") || "—"}</p>
          <p className="mt-2">{question.approvedAnswerCount} onaylı yanıt · {question.useCount} sınav kullanımı</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/15 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>;
}

function WarningBadges({ warnings, compact = false }: { warnings: readonly QuestionAnalyticsWarning[]; compact?: boolean }) {
  if (warnings.length === 0) return <Badge variant="success">Dengeli</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {warnings.slice(0, compact ? 2 : warnings.length).map((warning) => {
        const meta = warningMeta(warning);
        return <Badge key={warning} variant={meta.variant}>{meta.label}</Badge>;
      })}
      {compact && warnings.length > 2 ? <Badge variant="outline">+{warnings.length - 2}</Badge> : null}
    </div>
  );
}

function warningMeta(warning: QuestionAnalyticsWarning): { label: string; variant: "outline" | "warning" | "danger" | "soft" } {
  if (warning === "insufficient_evidence") return { label: "Veri az", variant: "outline" };
  if (warning === "very_easy") return { label: "Çok kolay", variant: "soft" };
  if (warning === "very_hard") return { label: "Çok zor", variant: "warning" };
  if (warning === "negative_discrimination") return { label: "Negatif ayırt edicilik", variant: "danger" };
  if (warning === "unused_option") return { label: "İşaretlenmeyen seçenek", variant: "warning" };
  return { label: "AI–öğretmen farkı yüksek", variant: "danger" };
}
