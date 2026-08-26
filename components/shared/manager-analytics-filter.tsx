import Link from "next/link";
import { CalendarRange, Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ManagerAnalytics, ManagerAnalyticsScope } from "@/lib/manager-analytics";

export function ManagerAnalyticsFilter({
  basePath,
  scope,
  options,
}: {
  basePath: string;
  scope: ManagerAnalyticsScope;
  options: ManagerAnalytics["filterOptions"];
}) {
  const active = Boolean(
    scope.subject ||
      scope.examId ||
      scope.dateFrom ||
      scope.dateTo ||
      scope.masteryThreshold,
  );

  return (
    <form
      action={basePath}
      method="get"
      className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] print:hidden"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Analiz kapsamı</p>
            <p className="text-xs text-muted-foreground">
              Tüm kartlar, tablolar ve teşhisler aynı kapsamı kullanır.
            </p>
          </div>
        </div>
        {active ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={basePath}>
              <RotateCcw />
              Sıfırla
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.25fr_.8fr_.8fr_.65fr_auto] xl:items-end">
        <Field label="Ders">
          <select name="ders" defaultValue={scope.subject ?? ""} className={fieldClassName}>
            <option value="">Tüm dersler</option>
            {options.subjects.map((subject) => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </Field>

        <Field label="Sınav">
          <select name="sinav" defaultValue={scope.examId ?? ""} className={fieldClassName}>
            <option value="">Tüm sınavlar</option>
            {options.exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} · {exam.subject}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Başlangıç">
          <input
            type="date"
            name="baslangic"
            defaultValue={scope.dateFrom ?? ""}
            className={fieldClassName}
          />
        </Field>

        <Field label="Bitiş">
          <input
            type="date"
            name="bitis"
            defaultValue={scope.dateTo ?? ""}
            className={fieldClassName}
          />
        </Field>

        <Field label="Başarı eşiği">
          <select
            name="esik"
            defaultValue={String(scope.masteryThreshold ?? 60)}
            className={fieldClassName}
          >
            {[50, 60, 70, 80].map((threshold) => (
              <option key={threshold} value={threshold}>%{threshold}</option>
            ))}
          </select>
        </Field>

        <Button type="submit" className="w-full xl:w-auto">
          <CalendarRange />
          Uygula
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

const fieldClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
