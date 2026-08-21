"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  FileText,
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
  type TopicGroup,
} from "@/lib/exam-paper";
import type { Exam, Question, QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Egitmenin soru havuzu.
 *
 * Havuz uc kademe halinde, her kademede kutucuklarla gezilir:
 *   Atolye dali  ->  Konu  ->  Soru listesi (isaretlenebilir)
 *
 * Kutucuklar sorulardan turetilir; altinda sorusu olmayan dal veya konu
 * kutucugu hic olusmaz. Icerik uzmani yeni bir dala soru onayladigi anda o
 * dalin kutucugu kendiliginden belirir.
 *
 * Onay / red BURADA YOKTUR - o icerik uzmaninin isidir. Egitmen yalnizca
 * onaylanmis sorulari gorur, secer ve bir sinava ekler. Sinavin kendisi
 * "Sinavlar" ekranindan yonetilir.
 */

type TypeFilter = QuestionType | "hepsi";

export interface QuestionPoolBrowserProps {
  /** Havuzdaki onayli sorular. */
  questions: readonly Question[];
  /** Egitmenin sinavlari; secilen sorular bunlardan birine eklenir. */
  exams: readonly Exam[];
  /** Supabase yoksa ekleme adimi hata dondurur. */
  canPersist?: boolean;
}

export function QuestionPoolBrowser({
  questions,
  exams,
  canPersist = false,
}: QuestionPoolBrowserProps) {
  const router = useRouter();

  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [targetCount, setTargetCount] = React.useState("20");
  const [examId, setExamId] = React.useState<string>(exams[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);

  /** Havuzun tamami: dal -> konu -> soru. Filtreden etkilenmez. */
  const allCategories = React.useMemo(() => groupByCategory(questions), [questions]);

  /** Arama / tip filtresinden gecmis hali. */
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

  const openTopic = React.useMemo(
    () =>
      openCategory === null || activeTopic === null
        ? null
        : (openCategory.topics.find((group) => group.topic === activeTopic) ?? null),
    [openCategory, activeTopic],
  );

  const selectedCount = selectedIds.size;

  /* ------------------------------ gezinme -------------------------------- */

  function backToCategories() {
    setActiveCategory(null);
    setActiveTopic(null);
  }

  /* ------------------------------ secim ---------------------------------- */

  function toggleQuestion(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTopic(group: TopicGroup) {
    const ids = group.questions.map((question) => question.id);
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
   * Konular arasinda sirayla gezerek istenen sayida soru secer.
   * Kapsam bulundugun kademedir: konu acikken o konudan, dal acikken o dalin
   * konularindan, dal listesindeyken gorunen tum dallardan alir.
   */
  function autoSelect() {
    const source = openTopic
      ? [openTopic]
      : openCategory
        ? openCategory.topics
        : visibleCategories.flatMap((group) => group.topics);

    const available = source.reduce((total, group) => total + group.questions.length, 0);
    const requested = Number.parseInt(targetCount, 10);

    if (!Number.isFinite(requested) || requested < 1) {
      toast.error("Gecerli bir soru sayisi girin.");
      return;
    }

    const picked = pickBalanced(source, Math.min(requested, available));
    setSelectedIds(new Set(picked));

    if (picked.length < requested) {
      toast.warning(`Bu kapsamda ${picked.length} uygun soru var`, {
        description: "Ust kademeye cikin, filtreyi genisletin veya daha az soru isteyin.",
      });
    } else {
      toast.success(`${picked.length} soru secildi`, {
        description: `${source.length} konudan dengeli dagitildi.`,
      });
    }
  }

  async function handleAddToExam() {
    if (!examId) {
      toast.error("Once bir sinav secin.");
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
        selectedCount={selectedCount}
        targetCount={targetCount}
        onTargetCountChange={setTargetCount}
        onAutoSelect={autoSelect}
        autoSelectScope={
          openTopic
            ? `${openTopic.topic} konusundan`
            : openCategory
              ? `${openCategory.label} dalinin konularindan`
              : "gorunen tum dallardan"
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
              placeholder="Dal, konu veya soru ara..."
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
              <SelectItem value="hepsi">Tum soru tipleri</SelectItem>
              <SelectItem value="test">Coktan secmeli</SelectItem>
              <SelectItem value="acik_uclu">Acik uclu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {openCategory === null ? (
          /* ------------- 1. kademe: atolye dali kutucuklari -------------- */
          visibleCategories.length === 0 ? (
            <NoMatch />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {visibleCategories.length} dal ·{" "}
                {visibleCategories.reduce((sum, g) => sum + g.topics.length, 0)} konu ·{" "}
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
                      setActiveTopic(null);
                    }}
                  />
                ))}
              </div>
            </>
          )
        ) : openTopic === null ? (
          /* ------------- 2. kademe: konu kutucuklari --------------------- */
          <>
            <Breadcrumb
              trail={[{ label: "Atolye dallari", onClick: backToCategories }]}
              current={openCategory.label}
              meta={`${openCategory.topics.length} konu · ${openCategory.questionCount} soru`}
            />

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {openCategory.topics.map((topic) => (
                <TopicCard
                  key={topic.topic}
                  group={topic}
                  selectedIds={selectedIds}
                  onOpen={() => setActiveTopic(topic.topic)}
                  onToggleAll={() => toggleTopic(topic)}
                />
              ))}
            </div>
          </>
        ) : (
          /* ------------- 3. kademe: sorular ------------------------------ */
          <>
            <Breadcrumb
              trail={[
                { label: "Atolye dallari", onClick: backToCategories },
                { label: openCategory.label, onClick: () => setActiveTopic(null) },
              ]}
              current={openTopic.topic}
              meta={`${openTopic.questions.length} soru`}
            />

            <QuestionList
              group={openTopic}
              selectedIds={selectedIds}
              onToggleAll={() => toggleTopic(openTopic)}
              onToggleQuestion={toggleQuestion}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. kademe - atolye dali kutucugu                                          */
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
  const selectedCount = group.topics.reduce(
    (total, topic) =>
      total + topic.questions.filter((question) => selectedIds.has(question.id)).length,
    0,
  );

  const preview = group.topics.slice(0, 3);
  const rest = group.topics.length - preview.length;

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
          <Badge variant="success">{selectedCount} secili</Badge>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="font-semibold leading-snug">{group.label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {group.topics.length} konu · {group.questionCount} soru
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {preview.map((topic) => (
          <span
            key={topic.topic}
            className="max-w-full truncate rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
          >
            {topic.topic}
          </span>
        ))}
        {rest > 0 ? (
          <span className="rounded border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground">
            +{rest} konu
          </span>
        ) : null}
      </div>

      <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
        Konulari ac
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. kademe - konu kutucugu                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Konu karti. Kartin govdesi konunun sorularina girer; sol ustteki kutucuk
 * ise konudaki tum sorulari tek hamlede secer. Ikisi ic ice degil kardes
 * ogedir - buton icinde buton gecerli HTML degildir.
 */
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
  const selectedCount = group.questions.filter((question) =>
    selectedIds.has(question.id),
  ).length;
  const allSelected = selectedCount === group.questions.length;

  const multipleChoice = group.questions.filter(
    (question) => question.type === "test",
  ).length;
  const openEnded = group.questions.length - multipleChoice;

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors",
        "hover:border-primary/50 hover:bg-accent/40 focus-within:border-primary/50",
        selectedCount > 0 && "border-primary/40",
      )}
    >
      <label className="shrink-0 cursor-pointer p-1" title="Konudaki tum sorulari sec">
        <Checkbox
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={onToggleAll}
          aria-label={`${group.topic} konusundaki tum sorulari sec`}
        />
      </label>

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-2 text-left focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <Layers className="h-4 w-4 shrink-0 text-primary" />

          {selectedCount > 0 ? (
            <Badge variant="success">{selectedCount} secili</Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="font-medium leading-snug">{group.topic}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {group.questions.length} soru
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {multipleChoice > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              {multipleChoice} coktan secmeli
            </span>
          ) : null}
          {openEnded > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              {openEnded} acik uclu
            </span>
          ) : null}
        </div>

        <span className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-primary">
          Sorulari ac
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. kademe - soru listesi                                                  */
/* -------------------------------------------------------------------------- */

function QuestionList({
  group,
  selectedIds,
  onToggleAll,
  onToggleQuestion,
}: {
  group: TopicGroup;
  selectedIds: ReadonlySet<string>;
  onToggleAll: () => void;
  onToggleQuestion: (id: string) => void;
}) {
  const selectedCount = group.questions.filter((question) =>
    selectedIds.has(question.id),
  ).length;
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
          Tumunu sec
        </label>

        <span className="ml-auto text-sm text-muted-foreground">
          {selectedCount} / {group.questions.length} secili
        </span>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {group.questions.map((question) => (
          <QuestionRow
            key={question.id}
            question={question}
            checked={selectedIds.has(question.id)}
            onToggle={() => onToggleQuestion(question.id)}
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
}: {
  question: Question;
  checked: boolean;
  onToggle: () => void;
}) {
  const Icon = question.type === "test" ? ListChecks : FileText;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        "hover:bg-accent/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5",
      )}
    >
      <Checkbox className="mt-0.5" checked={checked} onChange={onToggle} />

      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-relaxed">{question.text}</span>

        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5">
            <Icon className="h-3 w-3" />
            {question.type === "test" ? "Coktan secmeli" : "Acik uclu"}
          </span>

          {question.type === "test" ? (
            <span>
              Dogru cevap:{" "}
              <span className="font-semibold text-foreground">
                {question.correct_answer ?? "-"}
              </span>
            </span>
          ) : (
            <span>{question.rubric ? "Rubrik hazir" : "Rubrik tanimsiz"}</span>
          )}
        </span>
      </span>
    </label>
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
  /** Ustteki kademeler; ilki geri butonu olarak gosterilir. */
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
          Sinavin kendisi Sinavlar ekranindan yonetilir; buradan yalnizca soru
          eklenir.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pool-exam">Hedef sinav</Label>

          {exams.length === 0 ? (
            <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Henuz sinaviniz yok. Once{" "}
              <Link
                href="/dashboard/egitmen/sinavlar"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sinavlar
              </Link>{" "}
              ekranindan bir sinav olusturun, sonra buradan soru ekleyin.
            </div>
          ) : (
            <Select value={examId} onValueChange={onExamChange}>
              <SelectTrigger id="pool-exam">
                <SelectValue placeholder="Sinav secin" />
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
          <Label htmlFor="pool-target">Otomatik secim</Label>
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
              Dengeli sec
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
            Sinava ekle
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedCount === 0}
            onClick={onClear}
            aria-label="Secimi temizle"
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
/*  Bos durumlar                                                              */
/* -------------------------------------------------------------------------- */

function EmptyPool() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Library className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Havuzda onaylanmis soru yok</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Icerik uzmani uretilen taslaklari onayladikca sorular burada atolye
          dali ve konu basliklari altinda birikir.
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

/** Dali atanmamis grubun da kararli bir anahtari olmali. */
function keyOf(group: CategoryGroup): string {
  return group.category ?? "__kategorisiz__";
}

/**
 * Arama ve tip filtresini dal -> konu -> soru agacina uygular.
 * Dal adi aramayla eslesiyorsa altindaki konular kirpilmaz; boylece
 * "Ileri Robotik" yazinca dalin tamami gorulebilir.
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

      const topics = category.topics
        .map((topic) => {
          const topicMatches =
            categoryMatches || topic.topic.toLocaleLowerCase("tr").includes(needle);

          return {
            topic: topic.topic,
            questions: topic.questions.filter((question) => {
              if (typeFilter !== "hepsi" && question.type !== typeFilter) return false;
              if (topicMatches) return true;
              return question.text.toLocaleLowerCase("tr").includes(needle);
            }),
          };
        })
        .filter((topic) => topic.questions.length > 0);

      return {
        category: category.category,
        label: category.label,
        topics,
        questionCount: topics.reduce(
          (total, topic) => total + topic.questions.length,
          0,
        ),
      };
    })
    .filter((category) => category.topics.length > 0);
}
