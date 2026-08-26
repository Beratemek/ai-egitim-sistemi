import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GuardianStudentSummaryView } from "@/lib/guardian-analytics";

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export function GuardianStudentCard({
  student,
}: {
  student: GuardianStudentSummaryView;
}) {
  return (
    <Link
      href={`/dashboard/veli/ogrenciler/${student.student_id}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${student.student_name} gelişim raporunu aç`}
    >
      <Card className="h-full overflow-hidden transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/35 group-hover:shadow-[0_8px_24px_hsl(var(--foreground)/0.08)]">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-sm text-primary">
              {initials(student.student_name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{student.student_name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {student.classroom || "Sınıf atanmamış"}
                  </p>
                </div>
                {student.overdue_exam_count > 0 ? (
                  <Badge variant="warning" className="gap-1">
                    <CalendarClock className="h-3 w-3" />
                    {student.overdue_exam_count} geciken
                  </Badge>
                ) : (
                  <Badge variant="success">Geciken yok</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x rounded-xl border bg-muted/15 py-3">
            <Metric
              icon={ClipboardList}
              label="Atanan"
              value={student.assigned_exam_count}
            />
            <Metric
              icon={CheckCircle2}
              label="Sonuçlanan"
              value={student.completed_exam_count}
            />
            <Metric
              label="Ortalama"
              value={
                student.averageScore === null
                  ? "—"
                  : scoreFormatter.format(student.averageScore)
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Sınav sonuçlanma</span>
              <span className="font-semibold tabular-nums">
                %{student.completionRate}
              </span>
            </div>
            <Progress
              value={student.completionRate}
              className="h-1.5"
              aria-label={`${student.student_name} sınav sonuçlanma oranı`}
              aria-valuetext={`Yüzde ${student.completionRate}`}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-xs text-muted-foreground">
              {latestResultLabel(student.latestScore, student.latest_completed_at)}
            </span>
            <span className="flex items-center gap-1 font-semibold text-primary">
              Raporu aç
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: typeof ClipboardList;
}) {
  return (
    <div className="min-w-0 px-2 text-center sm:px-3">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        <span className="truncate text-[0.68rem] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-lg tabular-nums">{value}</p>
    </div>
  );
}

function latestResultLabel(score: number | null, completedAt: string | null): string {
  if (score === null || !completedAt) return "İlk sonuç bekleniyor";
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return `Son puan ${scoreFormatter.format(score)}`;
  const label = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
  }).format(date);
  return `Son puan ${scoreFormatter.format(score)} · ${label}`;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
}
