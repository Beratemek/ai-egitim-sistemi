"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  Library,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { addExamQuestions } from "@/app/actions/exams";
import { QuestionPreviewDialog } from "@/components/shared/question-preview-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  groupByCategory,
  pickBalanced,
  type CategoryGroup,
  type SubjectGroup,
  type TopicGroup,
} from "@/lib/question-pool";
import type { Exam, Question, QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Eğitmenin soru havuzu.
 *
 * Havuz dort kademe halinde, her kademede kutucuklarla gezilir:
 *   Atölye dalı  ->  Ders  ->  Konu  ->  Soru listesi (isaretlenebilir)
 *
 * Kutucuklar sorulardan turetilir; altinda sorusu olmayan dal, ders veya konu
 * kutucugu hic olusmaz. İçerik uzmanı yeni bir derse soru onayladigi anda o
 * dersin kutucugu kendiliginden belirir.
 *
 * Onay / red BURADA YOKTUR - o içerik uzmaninin isidir. Eğitmen yalnızca
 * onaylanmış soruları gorur, secer ve bir sınava ekler. Sınavın kendisi
 * "Sinavlar" ekranindan yonetilir.
 */

type TypeFilter = QuestionType | "hepsi";

export interface QuestionPoolBrowserProps {
  /** Havuzdaki onaylı sorular. */
  questions: readonly Question[];
  /** Eğitmenin sınavları; seçilen sorular bunlardan birine eklenir. */
  exams: readonly Exam[];
  /** Supabase yoksa ekleme adimi hata döndürür. */
  canPersist?: boolean;
}

export function QuestionPoolBrowser({
  questions,
  exams,
  canPersist = false,
}: QuestionPoolBrowserProps) {
  const router = useRouter();

  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [activeSubject, setActiveSubject] = React.useState<string | null>(null);
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [targetCount, setTargetCount] = React.useState("20");
  const [examId, setExamId] = React.useState<string>(exams[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  /** Onizlemesi acik soru; kapaliyken null. */
  const [preview, setPreview] = React.useState<Question | null>(null);

  /** Havuzun tamami: dal -> ders -> konu -> soru. Filtreden etkilenmez. */
  const allCategories = React.useMemo(() => groupByCategory(questions), [questions]);

  /** Arama / tip filtresinden geçmiş hali. */
  const visibleCategories = React.useMemo(
    () => filterCategories(allCategories, search, typeFilter),
    [allCategories, search, typeFilter],
  );

  const openCategory = React.useMemo(
    () =>
      activeCategory === null
        ? null
        : (visibleCategories.find((group) => keyOf(group) === activeCategory) ?? null),
    [visibleCategories, activeCategory],
  );

  const openSubject = React.useMemo(
    () =>
      openCategory === null || activeSubject === null
        ? null
        : (openCategory.subjects.find((group) => group.subject === activeSubject) ??
          null),
    [openCategory, activeSubject],
  );

  const openTopic = React.useMemo(
    () =>
      openSubject === null || activeTopic === null
        ? null
        : (openSubject.topics.find((group) => group.topic === activeTopic) ?? null),
    [openSubject, activeTopic],
  );

  /* ------------------------------ gezinme -------------------------------- */

  function backToCategories() {
    setActiveCategory(null);
    setActiveSubject(null);
    setActiveTopic(null);
  }

  function backToSubjects() {
    setActiveSubject(null);
    setActiveTopic(null);
  }

  /* ------------------------------ seçim ---------------------------------- */

  function toggleQuestion(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Verilen kumeyi topluca secer; hepsi seciliyse seçimi kaldirir. */
  function toggleMany(ids: readonly string[]) {
    const allSelected = ids.every((id) => selectedIds.has(id));

    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  /**
   * Konular arasında sirayla gezerek istenen sayida soru secer.
   * Kapsam bulundugun kademedir: konudayken o konudan, derste o dersin
   * konularindan, dalda o dalin tüm derslerinden, en ustte görünen her seyden.
   */
  function autoSelect() {
    const source = openTopic
      ? [openTopic]
      : openSubject
        ? openSubject.topics
        : openCategory
          ? topicsOfCategory(openCategory)
          : visibleCategories.flatMap(topicsOfCategory);

    const available = source.reduce((total, group) => total + group.questions.length, 0);
    const requested = Number.parseInt(targetCount, 10);

    if (!Number.isFinite(requested) || requested < 1) {
      toast.error("Geçerli bir soru sayısı girin.");
      return;
    }

    const picked = pickBalanced(source, Math.min(requested, available));
    setSelectedIds(new Set(picked));

    if (picked.length < requested) {
      toast.warning(`Bu kapsamda ${picked.length} uygun soru var`, {
        description: "Üst kademeye çıkın, filtreyi genişletin veya daha az soru isteyin.",
      });
    } else {
      toast.success(`${picked.length} soru secildi`, {
        description: `${source.length} konudan dengeli dagitildi.`,
      });
    }
  }

  async function handleAddToExam() {
    if (!examId) {
      toast.error("Önce bir sınav seçin.");
      return;
    }

    setPending(true);

    try {
      const result = await addExamQuestions(examId, [...selectedIds]);
      if (!result.ok) throw new Error(result.error);

      const exam = exams.find((item) => item.id === examId);
      toast.success(`${result.data.added} soru eklendi`, {
        description: exam ? `"${exam.title}" sinavina eklendi.` : undefined,
      });

      setSelectedIds(new Set());
      router.refresh();
    } catch (caught) {
      toast.error("Sorular eklenemedi", {
        description:
          caught instanceof Error ? caught.message : "Lutfen tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  /* ------------------------------- render -------------------------------- */

  if (questions.length === 0) return <EmptyPool />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <SelectionPanel
        exams={exams}
        examId={examId}
        onExamChange={setExamId}
        selectedCount={selectedIds.size}
        targetCount={targetCount}
        onTargetCountChange={setTargetCount}
        onAutoSelect={autoSelect}
        autoSelectScope={
          openTopic
            ? `${openTopic.topic} konusundan`
            : openSubject
              ? `${openSubject.subject} dersinin konularindan`
              : openCategory
                ? `${openCategory.label} dalinin tüm derslerinden`
                : "görünen tüm dallardan"
        }
        canPersist={canPersist}
        pending={pending}
        onAdd={() => void handleAddToExam()}
        onClear={() => setSelectedIds(new Set())}
      />

      <div className="space-y-4 lg:order-1">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Dal, ders, konu veya soru ara..."
              aria-label="Havuzda ara"
              className="pl-9"
            />
          </div>

          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as TypeFilter)}
          >
            <SelectTrigger className="sm:w-52" aria-label="Tipe gore filtrele">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hepsi">Tüm soru tipleri</SelectItem>
              <SelectItem value="test">Çoktan seçmeli</SelectItem>
              <SelectItem value="acik_uclu">Açık uçlu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {openCategory === null ? (
          /* ------------- 1. kademe: atölye dalı kutucuklari -------------- */
          visibleCategories.length === 0 ? (
            <NoMatch />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {visibleCategories.length} dal ·{" "}
                {visibleCategories.reduce((sum, g) => sum + g.subjects.length, 0)} ders ·{" "}
                {visibleCategories.reduce((sum, g) => sum + g.topicCount, 0)} konu ·{" "}
                {visibleCategories.reduce((sum, g) => sum + g.questionCount, 0)} soru
              </p>

              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {visibleCategories.map((group) => (
                  <CategoryCard
                    key={keyOf(group)}
                    group={group}
                    selectedIds={selectedIds}
                    onOpen={() => {
                      setActiveCategory(keyOf(group));
                      setActiveSubject(null);
                      setActiveTopic(null);
                    }}
                  />
                ))}
              </div>
            </>
          )
        ) : openSubject === null ? (
          /* ------------- 2. kademe: ders kutucuklari --------------------- */
          <>
            <Breadcrumb
              trail={[{ label: "Atölye dalları", onClick: backToCategories }]}
              current={openCategory.label}
              meta={`${openCategory.subjects.length} ders · ${openCategory.questionCount} soru`}
            />

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {openCategory.subjects.map((subject) => (
                <SubjectCard
                  key={subject.subject}
                  group={subject}
                  selectedIds={selectedIds}
                  onOpen={() => setActiveSubject(subject.subject)}
                  onToggleAll={() => toggleMany(idsOfSubject(subject))}
                />
              ))}
            </div>
          </>
        ) : openTopic === null ? (
          /* ------------- 3. kademe: konu kutucuklari --------------------- */
          <>
            <Breadcrumb
              trail={[
                { label: "Atölye dalları", onClick: backToCategories },
                { label: openCategory.label, onClick: backToSubjects },
              ]}
              current={openSubject.subject}
              meta={`${openSubject.topics.length} konu · ${openSubject.questionCount} soru`}
            />

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {openSubject.topics.map((topic) => (
                <TopicCard
                  key={topic.topic}
                  group={topic}
                  selectedIds={selectedIds}
                  onOpen={() => setActiveTopic(topic.topic)}
                  onToggleAll={() => toggleMany(idsOfTopic(topic))}
                />
              ))}
            </div>
          </>
        ) : (
          /* ------------- 4. kademe: sorular ------------------------------ */
          <>
            <Breadcrumb
              trail={[
                { label: "Atölye dalları", onClick: backToCategories },
                { label: openCategory.label, onClick: backToSubjects },
                { label: openSubject.subject, onClick: () => setActiveTopic(null) },
              ]}
              current={openTopic.topic}
              meta={`${openTopic.questions.length} soru`}
            />

            <QuestionList
              group={openTopic}
              selectedIds={selectedIds}
              onToggleAll={() => toggleMany(idsOfTopic(openTopic))}
              onToggleQuestion={toggleQuestion}
              onPreview={setPreview}
            />
          </>
        )}
      </div>

      <QuestionPreviewDialog
        question={preview}
        open={preview !== null}
        onOpenChange={(next) => {
          if (!next) setPreview(null);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. kademe - atölye dalı kutucugu                                          */
/* -------------------------------------------------------------------------- */

function CategoryCard({
  group,
  selectedIds,
  onOpen,
}: {
  group: CategoryGroup;
  selectedIds: ReadonlySet<string>;
  onOpen: () => void;
}) {
  const selectedCount = countSelected(idsOfCategory(group), selectedIds);
  const preview = group.subjects.slice(0, 3);
  const rest = group.subjects.length - preview.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex flex-col gap-3 rounded-xl border bg-card p-5 text-left shadow-sm transition-colors",
        "hover:border-primary/50 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selectedCount > 0 && "border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-5 w-5" />
        </span>

        {selectedCount > 0 ? (
          <Badge variant="success">{selectedCount} seçili</Badge>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="font-semibold leading-snug">{group.label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {group.subjects.length} ders · {group.topicCount} konu ·{" "}
          {group.questionCount} soru
        </p>
      </div>

      <ChipRow
        items={preview.map((subject) => subject.subject)}
        rest={rest}
        restLabel="ders"
      />

      <CardAction label="Dersleri ac" />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. kademe - ders kutucugu                                                 */
/* -------------------------------------------------------------------------- */

function SubjectCard({
  group,
  selectedIds,
  onOpen,
  onToggleAll,
}: {
  group: SubjectGroup;
  selectedIds: ReadonlySet<string>;
  onOpen: () => void;
  onToggleAll: () => void;
}) {
  const ids = idsOfSubject(group);
  const selectedCount = countSelected(ids, selectedIds);
  const preview = group.topics.slice(0, 3);
  const rest = group.topics.length - preview.length;

  return (
    <SelectableCard
      selectedCount={selectedCount}
      allSelected={selectedCount === ids.length}
      onToggleAll={onToggleAll}
      toggleLabel={`${group.subject} dersindeki tüm soruları seç`}
      onOpen={onOpen}
      icon={<GraduationCap className="h-4 w-4 shrink-0 text-primary" />}
      title={group.subject}
      subtitle={`${group.topics.length} konu · ${group.questionCount} soru`}
      action="Konuları ac"
    >
      <ChipRow
        items={preview.map((topic) => topic.topic)}
        rest={rest}
        restLabel="konu"
      />
    </SelectableCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. kademe - konu kutucugu                                                 */
/* -------------------------------------------------------------------------- */

function TopicCard({
  group,
  selectedIds,
  onOpen,
  onToggleAll,
}: {
  group: TopicGroup;
  selectedIds: ReadonlySet<string>;
  onOpen: () => void;
  onToggleAll: () => void;
}) {
  const ids = idsOfTopic(group);
  const selectedCount = countSelected(ids, selectedIds);

  const multipleChoice = group.questions.filter(
    (question) => question.type === "test",
  ).length;
  const openEnded = group.questions.length - multipleChoice;

  return (
    <SelectableCard
      selectedCount={selectedCount}
      allSelected={selectedCount === ids.length}
      onToggleAll={onToggleAll}
      toggleLabel={`${group.topic} konusundaki tüm soruları seç`}
      onOpen={onOpen}
      icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
      title={group.topic}
      subtitle={`${group.questions.length} soru`}
      action="Soruları ac"
    >
      <div className="flex flex-wrap gap-1.5">
        {multipleChoice > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
            <ListChecks className="h-3 w-3" />
            {multipleChoice} çoktan seçmeli
          </span>
        ) : null}
        {openEnded > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            {openEnded} açık uçlu
          </span>
        ) : null}
      </div>
    </SelectableCard>
  );
}

/**
 * Hem ders hem konu kutucugunun ortak govdesi.
 *
 * Kartin govdesi bir alt kademeye girer, sol ustteki kutucuk ise o kademedeki
 * tüm soruları tek hamlede secer. Ikisi ic ice değil kardes ogedir - buton
 * içinde buton geçerli HTML degildir.
 */
function SelectableCard({
  selectedCount,
  allSelected,
  onToggleAll,
  toggleLabel,
  onOpen,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  selectedCount: number;
  allSelected: boolean;
  onToggleAll: () => void;
  toggleLabel: string;
  onOpen: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors",
        "hover:border-primary/50 hover:bg-accent/40 focus-within:border-primary/50",
        selectedCount > 0 && "border-primary/40",
      )}
    >
      <label className="shrink-0 cursor-pointer p-1" title={toggleLabel}>
        <Checkbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={onToggleAll}
          aria-label={toggleLabel}
        />
      </label>

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-2 text-left focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          {icon}
          {selectedCount > 0 ? (
            <Badge variant="success">{selectedCount} seçili</Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="font-medium leading-snug">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {children}

        <CardAction label={action} />
      </button>
    </div>
  );
}

function CardAction({ label }: { label: string }) {
  return (
    <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </span>
  );
}

function ChipRow({
  items,
  rest,
  restLabel,
}: {
  items: readonly string[];
  rest: number;
  restLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="max-w-full truncate rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {item}
        </span>
      ))}
      {rest > 0 ? (
        <span className="rounded border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">
          +{rest} {restLabel}
        </span>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. kademe - soru listesi                                                  */
/* -------------------------------------------------------------------------- */

function QuestionList({
  group,
  selectedIds,
  onToggleAll,
  onToggleQuestion,
  onPreview,
}: {
  group: TopicGroup;
  selectedIds: ReadonlySet<string>;
  onToggleAll: () => void;
  onToggleQuestion: (id: string) => void;
  onPreview: (question: Question) => void;
}) {
  const selectedCount = countSelected(idsOfTopic(group), selectedIds);
  const allSelected = selectedCount === group.questions.length;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
          <Checkbox
            checked={allSelected}
            indeterminate={selectedCount > 0 && !allSelected}
            onChange={onToggleAll}
          />
          Tümünü seç
        </label>

        <span className="ml-auto text-sm text-muted-foreground">
          {selectedCount} / {group.questions.length} seçili
        </span>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {group.questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            checked={selectedIds.has(question.id)}
            onToggle={() => onToggleQuestion(question.id)}
            onPreview={() => onPreview(question)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function QuestionRow({
  question,
  checked,
  onToggle,
  onPreview,
}: {
  question: Question;
  checked: boolean;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const Icon = question.type === "test" ? ListChecks : FileText;

  return (
    <div
      className={cn(
        "group/row flex items-start gap-3 rounded-lg border p-3 transition-colors",
        "hover:bg-accent/50 focus-within:border-primary/50",
        checked && "border-primary/50 bg-primary/5",
      )}
    >
      <label className="shrink-0 cursor-pointer p-0.5" title="Sinava eklemek icin sec">
        <Checkbox
          checked={checked}
          onChange={onToggle}
          aria-label="Soruyu sec"
        />
      </label>

      <button
        type="button"
        onClick={onPreview}
        className="min-w-0 flex-1 text-left focus-visible:outline-none"
      >
        <span className="flex items-start gap-2">
          <span className="block text-sm leading-relaxed">{question.text}</span>
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" />
        </span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5">
            <Icon className="h-3 w-3" />
            {question.type === "test" ? "Çoktan seçmeli" : "Açık uçlu"}
          </span>

          {question.type === "test" ? (
            <span>
              Doğru cevap:{" "}
              <span className="font-semibold text-foreground">
                {question.correct_answer ?? "-"}
              </span>
            </span>
          ) : (
            <span>{question.rubric ? "Rubrik hazır" : "Rubrik tanımsız"}</span>
          )}
        </span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gezinti                                                                   */
/* -------------------------------------------------------------------------- */

function Breadcrumb({
  trail,
  current,
  meta,
}: {
  /** Ustteki kademeler; ilki geri butonu olarak gösterilir. */
  trail: readonly { label: string; onClick: () => void }[];
  current: string;
  meta: string;
}) {
  const first = trail[0];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={first?.onClick}
        className="gap-1.5 px-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {first?.label ?? "Geri"}
      </Button>

      {trail.slice(1).map((step) => (
        <React.Fragment key={step.label}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <button
            type="button"
            onClick={step.onClick}
            className="rounded px-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {step.label}
          </button>
        </React.Fragment>
      ))}

      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="font-semibold">{current}</span>

      <Badge variant="outline" className="font-normal">
        {meta}
      </Badge>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sag panel                                                                 */
/* -------------------------------------------------------------------------- */

function SelectionPanel({
  exams,
  examId,
  onExamChange,
  selectedCount,
  targetCount,
  onTargetCountChange,
  onAutoSelect,
  autoSelectScope,
  canPersist,
  pending,
  onAdd,
  onClear,
}: {
  exams: readonly Exam[];
  examId: string;
  onExamChange: (value: string) => void;
  selectedCount: number;
  targetCount: string;
  onTargetCountChange: (value: string) => void;
  onAutoSelect: () => void;
  autoSelectScope: string;
  canPersist: boolean;
  pending: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="lg:order-2 lg:sticky lg:top-20 lg:self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Secilenleri sinava ekle</CardTitle>
        <CardDescription>
          Sınavın kendisi Sınavlar ekranindan yonetilir; buradan yalnızca soru
          eklenir.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pool-exam">Hedef sınav</Label>

          {exams.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Henüz sınavınız yok. Önce{" "}
              <Link
                href="/dashboard/egitmen/sinavlar"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sınavlar
              </Link>{" "}
              ekranindan bir sınav oluşturun, sonra buradan soru ekleyin.
            </div>
          ) : (
            <Select value={examId} onValueChange={onExamChange}>
              <SelectTrigger id="pool-exam">
                <SelectValue placeholder="Sınav seçin" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="pool-target">Otomatik seçim</Label>
          <div className="flex gap-2">
            <Input
              id="pool-target"
              type="number"
              min={1}
              value={targetCount}
              onChange={(event) => onTargetCountChange(event.target.value)}
              className="w-20"
            />
            <Button variant="outline" className="flex-1" onClick={onAutoSelect}>
              <Wand2 />
              Dengeli seç
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bulundugunuz kademeden secer: su an{" "}
            <strong className="font-medium text-foreground">{autoSelectScope}</strong>{" "}
            alir.
          </p>
        </div>

        <Separator />

        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Secili soru</span>
          <span className="font-semibold tabular">{selectedCount} soru</span>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={selectedCount === 0 || exams.length === 0 || pending}
            onClick={onAdd}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Plus />}
            Sınava ekle
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedCount === 0}
            onClick={onClear}
            aria-label="Seçimi temizle"
          >
            <RotateCcw />
          </Button>
        </div>

        {canPersist ? null : (
          <p className="text-xs text-muted-foreground">
            Demo modunda ekleme kaydedilmez.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Boş durumlar                                                              */
/* -------------------------------------------------------------------------- */

function EmptyPool() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Library className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Havuzda onaylanmis soru yok</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          İçerik uzmanı üretilen taslakları onayladikca sorular burada atölye
          dalı, ders ve konu basliklari altinda birikir.
        </p>
      </CardContent>
    </Card>
  );
}

function NoMatch() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <Search className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Filtrelere uyan soru bulunamadi</p>
        <p className="text-sm text-muted-foreground">
          Arama terimini veya soru tipini degistirmeyi deneyin.
        </p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Yardimcilar                                                               */
/* -------------------------------------------------------------------------- */

/** Dalı atanmamış grubun da kararli bir anahtarı olmali. */
function keyOf(group: CategoryGroup): string {
  return group.category ?? "__kategorisiz__";
}

function topicsOfCategory(group: CategoryGroup): TopicGroup[] {
  return group.subjects.flatMap((subject) => subject.topics);
}

function idsOfTopic(group: TopicGroup): string[] {
  return group.questions.map((question) => question.id);
}

function idsOfSubject(group: SubjectGroup): string[] {
  return group.topics.flatMap(idsOfTopic);
}

function idsOfCategory(group: CategoryGroup): string[] {
  return group.subjects.flatMap(idsOfSubject);
}

function countSelected(ids: readonly string[], selected: ReadonlySet<string>): number {
  return ids.reduce((total, id) => (selected.has(id) ? total + 1 : total), 0);
}

/**
 * Arama ve tip filtresini dal -> ders -> konu -> soru agacina uygular.
 * Üst kademenin adi aramayla eslesiyorsa altindakiler kirpilmaz; boylece
 * "İleri Robotik" yazinca dalin tamami gorulebilir.
 */
function filterCategories(
  categories: readonly CategoryGroup[],
  search: string,
  typeFilter: TypeFilter,
): CategoryGroup[] {
  const needle = search.trim().toLocaleLowerCase("tr");

  return categories
    .map((category) => {
      const categoryMatches =
        !needle || category.label.toLocaleLowerCase("tr").includes(needle);

      const subjects = category.subjects
        .map((subject) => {
          const subjectMatches =
            categoryMatches || subject.subject.toLocaleLowerCase("tr").includes(needle);

          const topics = subject.topics
            .map((topic) => {
              const topicMatches =
                subjectMatches || topic.topic.toLocaleLowerCase("tr").includes(needle);

              return {
                topic: topic.topic,
                questions: topic.questions.filter((question) => {
                  if (typeFilter !== "hepsi" && question.type !== typeFilter) {
                    return false;
                  }
                  if (topicMatches) return true;
                  return question.text.toLocaleLowerCase("tr").includes(needle);
                }),
              };
            })
            .filter((topic) => topic.questions.length > 0);

          return {
            subject: subject.subject,
            topics,
            questionCount: topics.reduce(
              (total, topic) => total + topic.questions.length,
              0,
            ),
          };
        })
        .filter((subject) => subject.topics.length > 0);

      return {
        category: category.category,
        label: category.label,
        subjects,
        topicCount: subjects.reduce((total, s) => total + s.topics.length, 0),
        questionCount: subjects.reduce((total, s) => total + s.questionCount, 0),
      };
    })
    .filter((category) => category.subjects.length > 0);
}
