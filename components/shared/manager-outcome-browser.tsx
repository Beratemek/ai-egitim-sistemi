"use client";

import * as React from "react";
import { Search, Target } from "lucide-react";

import { ManagerScore } from "@/components/shared/manager-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagerOutcomeSummary } from "@/lib/manager-analytics";
import type { OutcomeEvidenceLevel } from "@/lib/outcome-diagnostics";

type OutcomeFilter = "all" | "weak" | "early" | "measured" | "unmeasured";

const FILTERS: Array<{ value: OutcomeFilter; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "weak", label: "Güçlendirilmeli" },
  { value: "early", label: "Erken sinyal" },
  { value: "measured", label: "Ölçülen" },
  { value: "unmeasured", label: "Ölçülmeyen" },
];

export function ManagerOutcomeBrowser({
  outcomes,
  initialFilter = "all",
}: {
  outcomes: readonly ManagerOutcomeSummary[];
  initialFilter?: OutcomeFilter;
}) {
  const [filter, setFilter] = React.useState<OutcomeFilter>(initialFilter);
  const [subject, setSubject] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const subjects = React.useMemo(
    () => [...new Set(outcomes.map((outcome) => outcome.subject))].sort((a, b) => a.localeCompare(b, "tr")),
    [outcomes],
  );
  const visible = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return outcomes.filter((outcome) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "weak" && outcome.isActionableWeak) ||
        (filter === "early" && outcome.evidenceLevel === "early") ||
        (filter === "measured" && outcome.averageScore !== null) ||
        (filter === "unmeasured" && outcome.averageScore === null);
      const matchesSubject = subject === "all" || outcome.subject === subject;
      const haystack = `${outcome.outcomeText} ${outcome.subject} ${outcome.topic}`.toLocaleLowerCase("tr-TR");
      return matchesFilter && matchesSubject && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [filter, outcomes, query, subject]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Kazanım durum filtresi">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={filter === item.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Ders filtresi">
              <SelectValue placeholder="Ders seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm dersler</SelectItem>
              {subjects.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="relative block sm:w-72">
            <span className="sr-only">Kazanım ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kazanım, konu veya ders ara"
              className="pl-9"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Kazanım</TableHead>
              <TableHead>Ders / konu</TableHead>
              <TableHead className="text-right">Başarı</TableHead>
              <TableHead>Kanıt düzeyi</TableHead>
              <TableHead className="text-right">Onaylı yanıt</TableHead>
              <TableHead className="text-right">Öğrenci / sınıf</TableHead>
              <TableHead className="text-right">Bekleyen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-44 text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Target className="h-5 w-5" />
                  </span>
                  <p className="mt-3 font-medium">Filtrelerle eşleşen kazanım yok</p>
                  <p className="mt-1 text-sm text-muted-foreground">Aramayı veya durum filtresini değiştirebilirsiniz.</p>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((outcome) => (
                <TableRow key={outcome.outcomeId}>
                  <TableCell className="min-w-72 max-w-xl">
                    <p className="line-clamp-2 font-medium leading-snug">{outcome.outcomeText}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {outcome.measuredQuestionCount} ölçülen · {outcome.linkedQuestionCount} sınava bağlı · {outcome.questionCount} havuzda
                    </p>
                  </TableCell>
                  <TableCell className="min-w-40">
                    <p className="text-sm">{outcome.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{outcome.topic}</p>
                  </TableCell>
                  <TableCell className="min-w-36 text-right">
                    <ManagerScore score={outcome.averageScore} />
                    <Progress value={outcome.averageScore ?? 0} className="mt-2 ml-auto h-1 w-28" />
                  </TableCell>
                  <TableCell>
                    <EvidenceBadge level={outcome.evidenceLevel} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{outcome.answerCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {outcome.studentCount} / {outcome.classroomCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {outcome.pendingCount > 0 ? (
                      <Badge variant="warning">{outcome.pendingCount}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-right text-xs text-muted-foreground">
        {visible.length} / {outcomes.length} kazanım gösteriliyor
      </p>
    </div>
  );
}

function EvidenceBadge({ level }: { level: OutcomeEvidenceLevel }) {
  if (level === "strong") return <Badge variant="success">Güçlü kanıt</Badge>;
  if (level === "supported") return <Badge variant="soft">Destekli bulgu</Badge>;
  if (level === "early") return <Badge variant="warning">Erken sinyal</Badge>;
  return <Badge variant="outline">Ölçülmedi</Badge>;
}
