import Link from "next/link";
import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  InstructorQuestionAnalytics,
  QuestionAnalyticsScope,
} from "@/lib/question-analytics";

export function InstructorQuestionFilter({
  scope,
  options,
}: {
  scope: QuestionAnalyticsScope;
  options: InstructorQuestionAnalytics["filterOptions"];
}) {
  const active = Object.values(scope).some(Boolean);
  return (
    <form
      action="/dashboard/egitmen/soru-analizi"
      method="get"
      className="rounded-2xl border bg-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Soru analizi kapsamı</p>
            <p className="text-xs text-muted-foreground">Sınav tarihi; bitiş, başlangıç veya oluşturma tarihinden ilk bulunan değerdir.</p>
          </div>
        </div>
        {active ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/egitmen/soru-analizi"><RotateCcw />Sıfırla</Link>
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1.25fr_.8fr_.75fr_.8fr_.8fr_auto] xl:items-end">
        <Field label="Ders">
          <select name="ders" defaultValue={scope.subject ?? ""} className={fieldClassName}>
            <option value="">Tüm dersler</option>
            {options.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Sınav">
          <select name="sinav" defaultValue={scope.examId ?? ""} className={fieldClassName}>
            <option value="">Tüm sınavlar</option>
            {options.exams.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.subject}</option>)}
          </select>
        </Field>
        <Field label="Sınıf">
          <select name="sinif" defaultValue={scope.classroom ?? ""} className={fieldClassName}>
            <option value="">Tüm sınıflar</option>
            {options.classrooms.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Soru türü">
          <select name="tur" defaultValue={scope.questionType ?? ""} className={fieldClassName}>
            <option value="">Tümü</option>
            <option value="test">Test</option>
            <option value="acik_uclu">Açık uçlu</option>
          </select>
        </Field>
        <Field label="Başlangıç">
          <input type="date" name="baslangic" defaultValue={scope.dateFrom ?? ""} className={fieldClassName} />
        </Field>
        <Field label="Bitiş">
          <input type="date" name="bitis" defaultValue={scope.dateTo ?? ""} className={fieldClassName} />
        </Field>
        <Button type="submit">Uygula</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>{label}</span>{children}</label>;
}

const fieldClassName =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15";
