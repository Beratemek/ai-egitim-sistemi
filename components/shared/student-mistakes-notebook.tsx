"use client";

import * as React from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  FilterX,
  MessageSquareQuote,
  NotebookTabs,
  Target,
} from "lucide-react";

import { MistakeCoachDialog } from "@/components/shared/mistake-coach-dialog";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { QuestionVisual } from "@/components/shared/question-visual";
import { StatCard } from "@/components/shared/stat-card";
import { StudentRecommendationActions } from "@/components/shared/student-recommendation-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  filterStudentMistakes,
  type StudentMistakeNotebook,
  type StudentMistakeRecord,
  type StudentMistakeStatus,
} from "@/lib/student-mistakes";
import { cn, formatDateTime } from "@/lib/utils";

const ALL_FILTERS = "__all__";

const STATUS_META: Record<
  StudentMistakeStatus,
  {
    label: string;
    badge: "danger" | "warning" | "outline";
    border: string;
  }
> = {
  yanlis: {
    label: "Yanlış",
    badge: "danger",
    border: "border-l-destructive/70",
  },
  kismi: {
    label: "Eksik öğrenme",
    badge: "warning",
    border: "border-l-warning/70",
  },
  bos: {
    label: "Boş bırakıldı",
    badge: "outline",
    border: "border-l-muted-foreground/40",
  },
};

export function StudentMistakesNotebook({
  notebook,
}: {
  notebook: StudentMistakeNotebook;
}) {
  const [subject, setSubject] = React.useState(ALL_FILTERS);
  const [examId, setExamId] = React.useState(ALL_FILTERS);
  const [outcomeKey, setOutcomeKey] = React.useState(ALL_FILTERS);
  const [status, setStatus] = React.useState(ALL_FILTERS);

  const filtered = React.useMemo(
    () =>
      filterStudentMistakes(notebook.records, {
        subject: subject === ALL_FILTERS ? null : subject,
        examId: examId === ALL_FILTERS ? null : examId,
        outcomeKey: outcomeKey === ALL_FILTERS ? null : outcomeKey,
        status:
          status === ALL_FILTERS ? null : (status as StudentMistakeStatus),
      }),
    [examId, notebook.records, outcomeKey, status, subject],
  );
  const hasFilters = [subject, examId, outcomeKey, status].some(
    (value) => value !== ALL_FILTERS,
  );

  function resetFilters() {
    setSubject(ALL_FILTERS);
    setExamId(ALL_FILTERS);
    setOutcomeKey(ALL_FILTERS);
    setStatus(ALL_FILTERS);
  }

  if (notebook.records.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center py-14 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="mt-4 font-display text-xl">Defterin şimdilik boş</p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Sonuçlanan sınavlarında tekrar gerektiren, eksik kalan veya boş
            bıraktığın sorular burada bir araya gelecek.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tekrar bekleyen"
          value={notebook.summary.total}
          hint="soru kanıtı"
          icon={NotebookTabs}
          accent="cat1"
        />
        <StatCard
          label="Yanlış cevap"
          value={notebook.summary.wrong}
          hint="yeniden çöz"
          icon={Target}
          accent="cat2"
        />
        <StatCard
          label="Eksik öğrenme"
          value={notebook.summary.partial}
          hint="geri bildirimi incele"
          icon={BookOpenCheck}
          accent="cat3"
        />
        <StatCard
          label="Etkilenen kazanım"
          value={notebook.summary.outcomeCount}
          hint={`${notebook.summary.blank} boş cevap`}
          icon={CircleDashed}
          accent="cat4"
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Ders"
                value={subject}
                allLabel="Tüm dersler"
                options={notebook.filterOptions.subjects}
                onValueChange={setSubject}
              />
              <FilterSelect
                label="Sınav"
                value={examId}
                allLabel="Tüm sınavlar"
                options={notebook.filterOptions.exams}
                onValueChange={setExamId}
              />
              <FilterSelect
                label="Kazanım"
                value={outcomeKey}
                allLabel="Tüm kazanımlar"
                options={notebook.filterOptions.outcomes}
                onValueChange={setOutcomeKey}
              />
              <FilterSelect
                label="Durum"
                value={status}
                allLabel="Tüm durumlar"
                options={[
                  { value: "yanlis", label: "Yanlış" },
                  { value: "kismi", label: "Eksik öğrenme" },
                  { value: "bos", label: "Boş bırakıldı" },
                ]}
                onValueChange={setStatus}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full xl:w-auto"
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              <FilterX className="h-4 w-4" />
              Filtreleri temizle
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
            Nihai puanı 60/100 altında kalan veya boş bırakılan {notebook.records.length}
            {" "}kayıttan {filtered.length} tanesi gösteriliyor.
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center py-12 text-center">
            <FilterX className="h-8 w-8 text-muted-foreground/55" />
            <p className="mt-3 font-medium">Bu filtrelerle eşleşen kayıt yok</p>
            <Button
              type="button"
              variant="link"
              className="mt-1"
              onClick={resetFilters}
            >
              Tüm kayıtları göster
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record, index) => (
            <MistakeEntry key={record.id} record={record} initiallyOpen={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  allLabel,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger aria-label={`${label} filtresi`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FILTERS}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function MistakeEntry({
  record,
  initiallyOpen,
}: {
  record: StudentMistakeRecord;
  initiallyOpen: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(initiallyOpen);
  const meta = STATUS_META[record.status];
  const planAction =
    record.status === "bos"
      ? "Soruyu yeniden oku, ilgili kazanımın kısa özetini çıkar ve benzer iki soru çöz."
      : record.status === "yanlis"
        ? "Geri bildirimi incele, hatalı adımı kendi cümlelerinle düzelt ve benzer üç soru çöz."
        : "Eksik kalan adımı tamamla, ardından aynı kazanımdan iki uygulama sorusu çöz.";

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className={cn(
        "group overflow-hidden rounded-2xl border border-l-4 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.05)]",
        meta.border,
      )}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:items-center sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-semibold text-primary">
          {record.questionNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={meta.badge}>{meta.label}</Badge>
            <Badge variant="soft">{record.subject}</Badge>
            <QuestionTypeBadge type={record.questionType} />
            <span className="text-xs text-muted-foreground">
              {formatDateTime(record.completedAt)}
            </span>
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold sm:text-base">
            {record.examTitle} · {record.questionNumber}. soru
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {record.outcomeLabel}
          </span>
        </span>
        <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 sm:mt-0" />
      </summary>

      <div className="border-t bg-muted/[0.08] p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="min-w-0 space-y-4">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Soru
              </p>
              <p className="mt-2 text-[15px] font-medium leading-relaxed">
                {record.questionText}
              </p>
              {record.visual ? (
                <QuestionVisual visual={record.visual} className="mt-3" />
              ) : null}
            </section>

            <section className="rounded-xl border bg-background/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Senin cevabın
              </p>
              <p
                className={cn(
                  "mt-2 whitespace-pre-wrap text-sm leading-relaxed",
                  record.status === "bos" && "italic text-muted-foreground",
                )}
              >
                {record.answerDisplay}
              </p>
            </section>

            {record.aiFeedback ? (
              <FeedbackBlock
                title="Değerlendirme geri bildirimi"
                text={record.aiFeedback}
              />
            ) : null}
            {record.instructorNote ? (
              <FeedbackBlock
                title="Eğitmen notu"
                text={record.instructorNote}
                instructor
              />
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border bg-background/75 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nihai değerlendirme
                  </p>
                  <p className="mt-1 font-display text-2xl tabular-nums">
                    {number(record.approvedScore)} / 100
                  </p>
                </div>
                <Badge variant="outline">
                  {number(record.earnedPoints)} / {number(record.questionPoints)} puan
                </Badge>
              </div>
              <Progress
                value={record.approvedScore}
                className="mt-3"
                indicatorClassName={
                  record.status === "yanlis"
                    ? "bg-destructive"
                    : record.status === "kismi"
                      ? "bg-warning"
                      : "bg-muted-foreground/40"
                }
              />
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/[0.045] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Kazanım odağı
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed">
                {record.outcomeLabel}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{record.topic}</p>
            </section>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="[&>button]:w-full">
                <MistakeCoachDialog
                  examId={record.examId}
                  questionId={record.questionId}
                  subject={record.subject}
                />
              </div>
              <StudentRecommendationActions
                id={`mistake:${record.examId}:${record.questionId}`}
                title={record.outcomeLabel}
                context={`${record.subject} · ${record.examTitle} · ${record.questionNumber}. soru`}
                action={planAction}
                evidence={`${number(record.approvedScore)}/100 onaylı puan · ${meta.label}`}
                outcomeId={record.outcomeId}
                latestExamId={record.examId}
              />
            </div>
          </aside>
        </div>
      </div>
    </details>
  );
}

function FeedbackBlock({
  title,
  text,
  instructor = false,
}: {
  title: string;
  text: string;
  instructor?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        instructor ? "border-primary/20 bg-primary/[0.045]" : "bg-background/75",
      )}
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquareQuote className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    </section>
  );
}

function number(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}
