"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  FileText,
  GraduationCap,
  Layers,
  Library,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ClipboardList,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { addExamQuestions } from "@/app/actions/exams";
import { ExamComposeDialog } from "@/components/shared/exam-compose-dialog";
import { ExamManualDialog } from "@/components/shared/exam-manual-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countByType,
  countTopicsByType,
  formatTypeCounts,
  groupBySubject,
  type SubjectGroup,
  type TopicGroup,
} from "@/lib/question-pool";
import type { Exam, Question, QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Eğitmenin soru havuzu.
 *
 * Havuz uc kademe halinde, her kademede kutucuklarla gezilir:
 *   Ders  ->  Konu  ->  Soru listesi (isaretlenebilir)
 *
 * UST KADEME DERSTIR. Atolye dali gezilen bir kademe degil, ders kartinda
 * gosterilen bir etikettir: egitmen sinav hazirlarken "hangi ders" diye
 * dusunuyor, "hangi atolye dali" diye degil. Dal ust kademe oldugunda dali
 * girilmemis sorular ayri bir "Kategori yok" kutusuna dusuyor ve ayni ders
 * ikiye bolunuyordu.
 *
 * Kutucuklar sorulardan turetilir; altinda sorusu olmayan ders veya konu
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

  const [activeSubject, setActiveSubject] = React.useState<string | null>(null);
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [examId, setExamId] = React.useState<string>(exams[0]?.id ?? "");
  const [pending, setPending] = React.useState(false);
  /** Onizlemesi acik olan sorunun kimligi; kapaliyken null. */
  const [openQuestionId, setOpenQuestionId] = React.useState<string | null>(null);
  /** Otomatik sinav kurma penceresi (ders/konu/sayi). */
  const [composeOpen, setComposeOpen] = React.useState(false);
  /** Isaretlenen sorularla elle sinav kurma penceresi. */
  const [manualOpen, setManualOpen] = React.useState(false);

  /**
   * Isaretlenen sorular, havuzdaki SIRAYLA.
   *
   * Elle kurma penceresi metni ve tipi gosterdigi icin yalnizca kimlik
   * yetmiyor; sira da onemli cunku sinav kagidinda ayni sirayla cikiyorlar.
   */
  const selectedQuestions = React.useMemo(
    () => questions.filter((question) => selectedIds.has(question.id)),
    [questions, selectedIds],
  );

  /** Havuzun tamami: ders -> konu -> soru. Filtreden etkilenmez. */
  const allSubjects = React.useMemo(() => groupBySubject(questions), [questions]);

  /** Arama / tip filtresinden geçmiş hali. */
  const visibleSubjects = React.useMemo(
    () => filterSubjects(allSubjects, search, typeFilter),
    [allSubjects, search, typeFilter],
  );

  const openSubject = React.useMemo(
    () =>
      activeSubject === null
        ? null
        : (visibleSubjects.find((group) => group.subject === activeSubject) ?? null),
    [visibleSubjects, activeSubject],
  );

  const openTopic = React.useMemo(
    () =>
      openSubject === null || activeTopic === null
        ? null
        : (openSubject.topics.find((group) => group.topic === activeTopic) ?? null),
    [openSubject, activeTopic],
  );

  /* ------------------------------ gezinme -------------------------------- */

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
    <div className="space-y-4">
      {/* ---------- Ust cubuk: arama, filtre, hedef sinav, otomatik secim ---------- */}
      <PoolToolbar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onCreateExam={() => setComposeOpen(true)}
      />

        {openSubject === null ? (
          /* ------------- 1. kademe: ders kutucuklari --------------------- */
          visibleSubjects.length === 0 ? (
            <NoMatch />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {visibleSubjects.length} ders ·{" "}
                {visibleSubjects.reduce((sum, g) => sum + g.topics.length, 0)} konu ·{" "}
                {visibleSubjects.reduce((sum, g) => sum + g.questionCount, 0)} soru
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                {formatTypeCounts(
                  countTopicsByType(visibleSubjects.flatMap((g) => g.topics)),
                )}
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleSubjects.map((subject) => (
                  <SubjectCard
                    key={subject.subject}
                    group={subject}
                    selectedIds={selectedIds}
                    onOpen={() => {
                      setActiveSubject(subject.subject);
                      setActiveTopic(null);
                    }}
                    onToggleAll={() => toggleMany(idsOfSubject(subject))}
                  />
                ))}
              </div>
            </>
          )
        ) : openTopic === null ? (
          /* ------------- 2. kademe: konu kutucuklari --------------------- */
          <>
            <Breadcrumb
              trail={[{ label: "Dersler", onClick: backToSubjects }]}
              current={openSubject.subject}
              meta={`${openSubject.topics.length} konu · ${openSubject.questionCount} soru · ${formatTypeCounts(countTopicsByType(openSubject.topics))}`}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          /* ------------- 3. kademe: sorular ------------------------------ */
          <>
            <Breadcrumb
              trail={[
                { label: "Dersler", onClick: backToSubjects },
                { label: openSubject.subject, onClick: () => setActiveTopic(null) },
              ]}
              current={openTopic.topic}
              meta={`${openTopic.questions.length} soru · ${formatTypeCounts(countByType(openTopic.questions))}`}
            />

            <QuestionList
              group={openTopic}
              selectedIds={selectedIds}
              onToggleAll={() => toggleMany(idsOfTopic(openTopic))}
              onToggleQuestion={toggleQuestion}
              openQuestionId={openQuestionId}
              onTogglePreview={(id) =>
                setOpenQuestionId((current) => (current === id ? null : id))
              }
            />
          </>
        )}

      {/* ---------- Secim bari ---------- */}
      <SelectionBar
        selectedCount={selectedIds.size}
        exams={exams}
        examId={examId}
        onExamChange={setExamId}
        canPersist={canPersist}
        pending={pending}
        onAdd={() => void handleAddToExam()}
        onCreate={() => setManualOpen(true)}
        onClear={() => setSelectedIds(new Set())}
      />

      <ExamManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        questions={selectedQuestions}
        subjectOptions={allSubjects.map((group) => group.subject)}
        defaultSubject={openSubject?.subject ?? null}
        onCreated={() => setSelectedIds(new Set())}
      />

      <ExamComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        subjects={allSubjects}
        selectedIds={[...selectedIds]}
        defaultSubject={openSubject?.subject ?? null}
        onCreated={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. kademe - ders kutucugu                                                 */
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
      meta={formatTypeCounts(countTopicsByType(group.topics))}
      action="Konuları ac"
    >
      {/* Atolye dali gezilen bir kademe degil; dersin hangi dala ait
          oldugunu burada etiket olarak gosteriyoruz. */}
      <p className="text-xs text-muted-foreground">
        {group.categoryLabels.join(" · ")}
      </p>

      <ChipRow
        items={preview.map((topic) => topic.topic)}
        rest={rest}
        restLabel="konu"
      />
    </SelectableCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. kademe - konu kutucugu                                                 */
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
      meta={formatTypeCounts(countByType(group.questions))}
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
  meta,
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
  /** Tip dagilimi ("40 test · 10 klasik") - toplam sayi tek basina yetmiyor. */
  meta?: string;
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
          {meta ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              {meta.split(" · ").map((parca) => (
                <span
                  key={parca}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-medium",
                    parca.includes("klasik")
                      ? "bg-highlight/15 text-highlight-foreground dark:text-highlight"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {parca}
                </span>
              ))}
            </p>
          ) : null}
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
/*  3. kademe - soru listesi                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Konudaki sorular - KAGIT gorunumu.
 *
 * Onceki surumde sorular koyu, dar satirlar halinde listeleniyordu ve siklar
 * yalnizca satiri acinca gorunuyordu; egitmen bir soruyu degerlendirmek icin
 * once tiklamak zorundaydi. Degerlendirme isi okuma isidir: soru ve siklari
 * AYNI ANDA, ogrencinin gorecegi duzende gorunmeli.
 *
 * Bu yuzden liste beyaz bir kagit uzerinde, genis ve punto tipografisiyle
 * ciziliyor - koyu temada bile. Dogru sik yesil vurguyla isaretli; bu ekran
 * yalnizca egitmene acik (bkz. questions_select politikasi).
 *
 * Acilir bolum yalnizca RUBRIK icin kaldi: acik uclu sorularin puanlama
 * olcutu her zaman gorunse liste okunmaz hale gelirdi.
 */
function QuestionList({
  group,
  selectedIds,
  onToggleAll,
  onToggleQuestion,
  openQuestionId,
  onTogglePreview,
}: {
  group: TopicGroup;
  selectedIds: ReadonlySet<string>;
  onToggleAll: () => void;
  onToggleQuestion: (id: string) => void;
  openQuestionId: string | null;
  onTogglePreview: (id: string) => void;
}) {
  const selectedCount = countSelected(idsOfTopic(group), selectedIds);
  const allSelected = selectedCount === group.questions.length;

  return (
    <div className="space-y-3">
      {/* ---------- Kagidin ustundeki denetim seridi ---------- */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
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
      </div>

      {/* ---------- Kagit ---------- */}
      <div className="rounded-xl bg-white px-6 py-5 text-slate-900 shadow-sm ring-1 ring-slate-300 sm:px-10 sm:py-8">
        <div className="mb-6 border-b border-slate-300 pb-3">
          <p className="text-[13pt] font-bold leading-tight">{group.topic}</p>
          <p className="mt-0.5 text-[9.5pt] text-slate-500">
            {group.questions.length} soru
          </p>
        </div>

        <ol className="space-y-7">
          {group.questions.map((question, index) => (
            <PaperQuestion
              key={question.id}
              question={question}
              number={index + 1}
              checked={selectedIds.has(question.id)}
              onToggle={() => onToggleQuestion(question.id)}
              expanded={openQuestionId === question.id}
              onTogglePreview={() => onTogglePreview(question.id)}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

/** Kagit uzerindeki tek soru: metin, siklar ve secim kutusu. */
function PaperQuestion({
  question,
  number,
  checked,
  onToggle,
  expanded,
  onTogglePreview,
}: {
  question: Question;
  number: number;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
  onTogglePreview: () => void;
}) {
  const isTest = question.type === "test";
  const options = question.options_json ?? [];

  return (
    <li
      className={cn(
        "-mx-3 rounded-lg px-3 py-2 transition-colors",
        checked && "bg-emerald-50 ring-1 ring-emerald-300",
      )}
    >
      <div className="flex gap-3">
        {/* Secim kutusu kagidin disinda kalir: sorunun kendisi degil, onun
            hakkindaki bir karar. */}
        <label
          className="mt-1 shrink-0 cursor-pointer"
          title="Sınava eklemek için seç"
        >
          <Checkbox
            tone="paper"
            checked={checked}
            onChange={onToggle}
            aria-label={`${number}. soruyu seç`}
          />
        </label>

        <div className="min-w-0 flex-1">
          <p className="text-[11.5pt] font-medium leading-[1.5]">
            <span className="mr-1.5 font-bold tabular-nums">{number}.</span>
            {question.text}
          </p>

          {isTest ? (
            <ol className="mt-2.5 space-y-1.5 text-[10.5pt] leading-[1.4]">
              {options.map((option) => {
                const isCorrect = option.key === question.correct_answer;

                return (
                  <li
                    key={option.key}
                    className={cn(
                      "flex gap-2 rounded px-2 py-1",
                      isCorrect && "bg-emerald-100 font-medium",
                    )}
                  >
                    <span className="shrink-0 font-semibold">{option.key})</span>
                    <span className="min-w-0">{option.text}</span>
                    {isCorrect ? (
                      <span className="ml-auto shrink-0 self-center text-[8pt] font-semibold uppercase tracking-wide text-emerald-700">
                        doğru
                      </span>
                    ) : null}
                  </li>
                );
              })}

              {options.length === 0 ? (
                <li className="text-[10pt] italic text-slate-500">
                  Bu soruya şık tanımlanmamış.
                </li>
              ) : null}
            </ol>
          ) : (
            <>
              {/* Acik uclu: ogrencinin gorecegi bos satirlar */}
              <div className="mt-3 space-y-4" aria-hidden>
                {[0, 1, 2].map((line) => (
                  <div key={line} className="border-b border-dotted border-slate-400" />
                ))}
              </div>

              <button
                type="button"
                onClick={onTogglePreview}
                aria-expanded={expanded}
                className="mt-3 inline-flex items-center gap-1.5 text-[9.5pt] font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
              >
                Puanlama rubriği
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                />
              </button>

              {expanded ? (
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-100 px-3 py-2 font-sans text-[9.5pt] leading-relaxed text-slate-700">
                  {question.rubric ?? "Rubrik tanımlanmamış."}
                </pre>
              ) : null}
            </>
          )}
        </div>

        {/* Kunye: kagidin sag kenarinda, soruyu bolmeden */}
        <span className="hidden shrink-0 flex-col items-end gap-1 pt-0.5 text-[8.5pt] text-slate-500 sm:flex">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
            {isTest ? "Çoktan seçmeli" : "Açık uçlu"}
          </span>
          {question.ai_generated ? <span>AI üretti</span> : <span>Elle eklendi</span>}
        </span>
      </div>
    </li>
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
/*  Ust cubuk                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Arama, tip filtresi, hedef sinav ve otomatik secim.
 *
 * Bu denetimler onceden sagda 340 piksellik bir sutunda duruyordu; kutucuklar
 * kalan dar alana sikisiyor, soru listesi de okunmaz hale geliyordu. Denetimler
 * ust cubuga alininca havuz TAM GENISLIK kullaniyor.
 */
function PoolToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onCreateExam,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  onCreateExam: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Ders, konu veya soru ara..."
          aria-label="Havuzda ara"
          className="pl-9"
        />
      </div>

      <Select
        value={typeFilter}
        onValueChange={(value) => onTypeFilterChange(value as TypeFilter)}
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

      {/*
        Sinav kurma dugmesi SECIMDEN BAGIMSIZ. Onceden yalnizca soru
        isaretlendikten sonra beliriyordu; oysa egitmen cogu zaman tek tek
        secmek degil "su dersten 20 soruluk sinav" demek istiyor.
      */}
      <Button className="gap-2 whitespace-nowrap" onClick={onCreateExam}>
        <Sparkles className="h-4 w-4" />
        Sınav oluştur
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Secim bari                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ekranin altina yapisan secim seridi.
 *
 * Yalnizca secim varken gorunur: bos dururken yer kaplamasi, havuzda gezinen
 * egitmenin ekranindan bir serit calardi. Secim yapildiginda ise nerede
 * olursa olsun elinin altinda olmali - listenin sonuna kadar kaydirip
 * dugme aramak zorunda kalmasin.
 */
function SelectionBar({
  selectedCount,
  exams,
  examId,
  onExamChange,
  canPersist,
  pending,
  onAdd,
  onCreate,
  onClear,
}: {
  selectedCount: number;
  exams: readonly Exam[];
  examId: string;
  onExamChange: (value: string) => void;
  canPersist: boolean;
  pending: boolean;
  onAdd: () => void;
  onCreate: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 mx-auto w-fit max-w-full">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur">
        <span className="px-1 text-sm font-medium">
          {selectedCount} soru seçili
        </span>

        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          onClick={onClear}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Temizle
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* Var olan sinava ekle: sinav secimi burada, cunku karar ancak
            secim yapildiktan sonra anlamli. */}
        {exams.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <Select value={examId} onValueChange={onExamChange}>
              <SelectTrigger className="h-9 w-44" aria-label="Var olan sınav">
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

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={pending || !examId || !canPersist}
              onClick={onAdd}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Ekle
            </Button>
          </div>
        ) : null}

        {/*
          Bu dugme "yapay zeka" dugmesi DEGIL: egitmen sorulari zaten kendi
          secti, burada yapilan is sinavin ayarlarini girmek. Kivilcim ikonu
          ve o cagrism bilerek kaldirildi.
        */}
        <Button size="sm" className="gap-1.5" onClick={onCreate}>
          <ClipboardList className="h-3.5 w-3.5" />
          Sınavı kur
        </Button>
      </div>
    </div>
  );
}

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

function idsOfTopic(group: TopicGroup): string[] {
  return group.questions.map((question) => question.id);
}

function idsOfSubject(group: SubjectGroup): string[] {
  return group.topics.flatMap(idsOfTopic);
}

function countSelected(ids: readonly string[], selected: ReadonlySet<string>): number {
  return ids.reduce((total, id) => (selected.has(id) ? total + 1 : total), 0);
}

/**
 * Arama ve tip filtresini ders -> konu -> soru agacina uygular.
 *
 * Ust kademenin adi aramayla eslesiyorsa altindakiler kirpilmaz; boylece
 * "Siber Guvenlik" yazinca dersin tamami gorulebilir. Dal adi da aranabilir:
 * gezinilen bir kademe olmasa da ders kartinda etiket olarak duruyor.
 */
function filterSubjects(
  subjects: readonly SubjectGroup[],
  search: string,
  typeFilter: TypeFilter,
): SubjectGroup[] {
  const needle = search.trim().toLocaleLowerCase("tr");

  return subjects
    .map((subject) => {
      const subjectMatches =
        !needle ||
        subject.subject.toLocaleLowerCase("tr").includes(needle) ||
        subject.categoryLabels.some((label) =>
          label.toLocaleLowerCase("tr").includes(needle),
        );

      const topics = subject.topics
        .map((topic) => {
          const topicMatches =
            subjectMatches || topic.topic.toLocaleLowerCase("tr").includes(needle);

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
        subject: subject.subject,
        topics,
        questionCount: topics.reduce((total, topic) => total + topic.questions.length, 0),
        categoryLabels: subject.categoryLabels,
      };
    })
    .filter((subject) => subject.topics.length > 0);
}
