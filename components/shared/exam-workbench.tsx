"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileText,
  Info,
  Layers,
  Library,
  ListChecks,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  Search,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { createExamFromPool } from "@/app/actions/exams";
import { ExamPaper, type ExamPaperMeta } from "@/components/shared/exam-paper";
import { PageHeader } from "@/components/shared/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import {
  groupBySubject,
  numberQuestions,
  pickBalanced,
  QUESTIONS_PER_PAGE,
  toFileName,
  UNASSIGNED_SUBJECT,
  type SubjectGroup,
  type TopicGroup,
} from "@/lib/exam-paper";
import type { Question, QuestionType } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Egitmenin soru havuzu + sinav uretecidir.
 *
 * Havuz uc kademe halinde, her kademede kutucuklarla gezilir:
 *   Ders kutucuklari  ->  Konu kutucuklari  ->  Soru listesi (isaretlenebilir)
 *
 * Ustune iki adim biner:
 *   1. "secim"     - havuzda gezip soru isaretle
 *   2. "onizleme"  - secilenlerden olusan A4 sinav kagidi, sag ustte indir
 *
 * Havuza soru ekleme / cikarma (onay-red) burada YOKTUR; o icerik uzmaninin
 * isidir. Egitmen yalnizca onaylanmis sorulari gorur ve kullanir.
 */

type Step = "secim" | "onizleme";
type TypeFilter = QuestionType | "hepsi";

export interface ExamWorkbenchProps {
  /** Havuzdaki onayli sorular. */
  questions: readonly Question[];
  /** Supabase bagliysa sinav "Sinavlarim" listesine kaydedilebilir. */
  canPersist?: boolean;
}

const DEFAULT_INSTRUCTIONS =
  "Coktan secmeli sorularda tek dogru sik vardir. Acik uclu sorulari ayrilan bosluga, okunakli yaziniz.";

export function ExamWorkbench({ questions, canPersist = false }: ExamWorkbenchProps) {
  const [step, setStep] = React.useState<Step>("secim");
  const [activeSubject, setActiveSubject] = React.useState<string | null>(null);
  const [activeTopic, setActiveTopic] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [targetCount, setTargetCount] = React.useState("20");
  const [showAnswerKey, setShowAnswerKey] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(null);

  const [meta, setMeta] = React.useState<ExamPaperMeta>({
    title: "Donem Sonu Sinavi",
    school: "",
    lesson: "",
    grade: "",
    date: "",
    duration: "40",
    instructions: DEFAULT_INSTRUCTIONS,
  });

  // Tarih sunucuda degil, tarayicida hesaplanir: SSR ciktisi ile istemcinin
  // saat dilimi ayrisirsa hydration uyusmazligi olusurdu.
  React.useEffect(() => {
    setMeta((current) => (current.date ? current : { ...current, date: todayIso() }));
  }, []);

  /** Havuzun tamami: ders -> konu -> soru. Filtreden etkilenmez. */
  const allSubjects = React.useMemo(() => groupBySubject(questions), [questions]);

  /** Arama / tip filtresinden gecmis hali. */
  const visibleSubjects = React.useMemo(
    () => filterSubjects(allSubjects, search, typeFilter),
    [allSubjects, search, typeFilter],
  );

  const openSubject = React.useMemo(
    () =>
      activeSubject === null
        ? null
        : (visibleSubjects.find((group) => group.subject === activeSubject) ??
          emptySubject(activeSubject)),
    [visibleSubjects, activeSubject],
  );

  const openTopic = React.useMemo(
    () =>
      openSubject === null || activeTopic === null
        ? null
        : (openSubject.topics.find((group) => group.topic === activeTopic) ?? {
            topic: activeTopic,
            questions: [],
          }),
    [openSubject, activeTopic],
  );

  /** Secili sorular, kagitta gorunecekleri sirayla (ders -> konu -> tip). */
  const selectedQuestions = React.useMemo(
    () =>
      allSubjects.flatMap((subject) =>
        subject.topics.flatMap((topic) =>
          topic.questions.filter((question) => selectedIds.has(question.id)),
        ),
      ),
    [allSubjects, selectedIds],
  );

  const paperQuestions = React.useMemo(
    () => numberQuestions(selectedQuestions),
    [selectedQuestions],
  );

  const count = paperQuestions.length;
  const sheetCount = Math.ceil(count / QUESTIONS_PER_PAGE) + (showAnswerKey ? 1 : 0);

  /* ------------------------------ gezinme -------------------------------- */

  function enterSubject(subject: string) {
    setActiveSubject(subject);
    setActiveTopic(null);
    // Kagittaki "Ders" satiri bos ise acilan dersle doldurulur; egitmen
    // elle bir sey yazdiysa ona dokunulmaz.
    setMeta((current) => (current.lesson ? current : { ...current, lesson: subject }));
  }

  function backToSubjects() {
    setActiveSubject(null);
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
    setSavedId(null);
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
    setSavedId(null);
  }

  /**
   * Konular arasinda sirayla gezerek istenen sayida soru secer.
   * Kapsam bulundugun kademedir: konu acikken o konudan, ders acikken o dersin
   * konularindan, ders listesindeyken gorunen tum derslerden alir.
   */
  function autoSelect() {
    const source = openTopic
      ? [openTopic]
      : openSubject
        ? openSubject.topics
        : visibleSubjects.flatMap((group) => group.topics);

    const available = source.reduce((total, group) => total + group.questions.length, 0);
    const requested = Number.parseInt(targetCount, 10);

    if (!Number.isFinite(requested) || requested < 1) {
      toast.error("Gecerli bir soru sayisi girin.");
      return;
    }

    const picked = pickBalanced(source, Math.min(requested, available));
    setSelectedIds(new Set(picked));
    setSavedId(null);

    if (picked.length < requested) {
      toast.warning(`Bu kapsamda ${picked.length} uygun soru var`, {
        description:
          "Ust kademeye cikin, filtreyi genisletin veya daha az soru isteyin.",
      });
    } else {
      toast.success(`${picked.length} soru secildi`, {
        description: `${source.length} konudan dengeli dagitildi.`,
      });
    }
  }

  /* ------------------------------ cikti ---------------------------------- */

  function handleDownload() {
    // Tarayicinin "PDF olarak kaydet" hedefinde dosya adi sekme basligindan
    // gelir; yazdirma bittiginde eski baslik geri konur.
    const originalTitle = document.title;
    document.title = toFileName(meta.title);

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
  }

  async function handleSave() {
    setSaving(true);

    try {
      const result = await createExamFromPool({
        title: meta.title,
        description: [meta.lesson, meta.grade].filter(Boolean).join(" - "),
        questionIds: paperQuestions.map((question) => question.id),
        points: paperQuestions.map((question) => question.points),
        date: meta.date,
      });

      if (!result.ok) throw new Error(result.error);

      setSavedId(result.data.id);
      toast.success("Sinav kaydedildi", {
        description: `${count} soru "Sinavlarim" listesine eklendi.`,
      });
    } catch (caught) {
      toast.error("Sinav kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lutfen tekrar deneyin.",
      });
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------ onizleme ------------------------------- */

  if (step === "onizleme") {
    const totalPoints = paperQuestions.reduce(
      (sum, question) => sum + question.points,
      0,
    );

    return (
      <>
        <PageHeader
          className="print:hidden"
          title={meta.title || "Sinav"}
          description={`${count} soru · ${totalPoints} puan · ${sheetCount} yaprak${
            showAnswerKey ? " (cevap anahtari dahil)" : ""
          }`}
          actions={
            <>
              <Button variant="outline" onClick={() => setStep("secim")}>
                <ArrowLeft />
                Duzenle
              </Button>

              {canPersist ? (
                <Button
                  variant="outline"
                  onClick={() => void handleSave()}
                  disabled={saving || savedId !== null}
                >
                  {saving ? (
                    <Loader2 className="animate-spin" />
                  ) : savedId ? (
                    <Check />
                  ) : (
                    <Save />
                  )}
                  {savedId ? "Kaydedildi" : "Sinavi kaydet"}
                </Button>
              ) : null}

              <Button onClick={handleDownload}>
                <Download />
                PDF olarak indir
              </Button>
            </>
          }
        />

        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground print:hidden">
          <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-medium text-foreground">PDF olarak indir</strong>{" "}
            tarayicinin yazdirma penceresini acar; hedef olarak{" "}
            <em>&quot;PDF olarak kaydet&quot;</em> secin. Kagit boyu A4, kenar
            bosluklari ve sayfa bolme otomatik ayarlidir - olcegi <em>%100</em>{" "}
            birakin.
          </span>
        </p>

        <ExamPaper
          meta={meta}
          questions={paperQuestions}
          showAnswerKey={showAnswerKey}
        />
      </>
    );
  }

  /* -------------------------------- secim -------------------------------- */

  return (
    <>
      <PageHeader
        title="Soru Havuzu"
        description="Havuz ders, konu ve soru olarak kirilir. Derse girin, konuyu acin, sorulari isaretleyip sinavi tek tikla olusturun."
        actions={
          <Button disabled={count === 0} onClick={() => setStep("onizleme")}>
            <FileText />
            Sinavi olustur{count > 0 ? ` (${count})` : ""}
          </Button>
        }
      />

      {questions.length === 0 ? (
        <EmptyPool />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <SetupPanel
            meta={meta}
            onMetaChange={setMeta}
            targetCount={targetCount}
            onTargetCountChange={setTargetCount}
            onAutoSelect={autoSelect}
            autoSelectScope={
              openTopic
                ? `${openTopic.topic} konusundan`
                : openSubject
                  ? `${openSubject.subject} dersinin konularindan`
                  : "gorunen tum derslerden"
            }
            showAnswerKey={showAnswerKey}
            onShowAnswerKeyChange={setShowAnswerKey}
            questions={paperQuestions}
            sheetCount={sheetCount}
            onClear={() => {
              setSelectedIds(new Set());
              setSavedId(null);
            }}
            onBuild={() => setStep("onizleme")}
          />

          <div className="space-y-4 lg:order-1">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Ders, konu veya soru ara..."
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

            {openSubject === null ? (
              /* ------------- 1. kademe: ders kutucuklari ----------------- */
              visibleSubjects.length === 0 ? (
                <NoMatch />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {visibleSubjects.length} ders ·{" "}
                    {visibleSubjects.reduce((sum, g) => sum + g.topics.length, 0)} konu ·{" "}
                    {visibleSubjects.reduce((sum, g) => sum + g.questionCount, 0)} soru
                  </p>

                  {visibleSubjects.some(
                    (group) => group.subject === UNASSIGNED_SUBJECT,
                  ) ? (
                    <UnassignedHint />
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {visibleSubjects.map((group) => (
                      <SubjectCard
                        key={group.subject}
                        group={group}
                        selectedIds={selectedIds}
                        onOpen={() => enterSubject(group.subject)}
                      />
                    ))}
                  </div>
                </>
              )
            ) : openTopic === null ? (
              /* ------------- 2. kademe: konu kutucuklari ----------------- */
              <>
                <Breadcrumb
                  trail={[{ label: "Dersler", onClick: backToSubjects }]}
                  current={openSubject.subject}
                  meta={`${openSubject.topics.length} konu · ${openSubject.questionCount} soru`}
                />

                {openSubject.topics.length === 0 ? (
                  <NoMatch />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                    {openSubject.topics.map((topic) => (
                      <TopicCard
                        key={topic.topic}
                        group={topic}
                        selectedIds={selectedIds}
                        onOpen={() => setActiveTopic(topic.topic)}
                        onToggleAll={() => toggleTopic(topic)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              /* ------------- 3. kademe: sorular -------------------------- */
              <>
                <Breadcrumb
                  trail={[
                    { label: "Dersler", onClick: backToSubjects },
                    {
                      label: openSubject.subject,
                      onClick: () => setActiveTopic(null),
                    },
                  ]}
                  current={openTopic.topic}
                  meta={`${openTopic.questions.length} soru`}
                />

                {openTopic.questions.length === 0 ? (
                  <NoMatch />
                ) : (
                  <QuestionList
                    group={openTopic}
                    selectedIds={selectedIds}
                    onToggleAll={() => toggleTopic(openTopic)}
                    onToggleQuestion={toggleQuestion}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. kademe - ders kutucugu                                                 */
/* -------------------------------------------------------------------------- */

function SubjectCard({
  group,
  selectedIds,
  onOpen,
}: {
  group: SubjectGroup;
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
        <p className="truncate font-semibold leading-snug">{group.subject}</p>
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

function SetupPanel({
  meta,
  onMetaChange,
  targetCount,
  onTargetCountChange,
  onAutoSelect,
  autoSelectScope,
  showAnswerKey,
  onShowAnswerKeyChange,
  questions,
  sheetCount,
  onClear,
  onBuild,
}: {
  meta: ExamPaperMeta;
  onMetaChange: React.Dispatch<React.SetStateAction<ExamPaperMeta>>;
  targetCount: string;
  onTargetCountChange: (value: string) => void;
  onAutoSelect: () => void;
  /** Otomatik secimin hangi kapsamdan alacagini anlatan ifade. */
  autoSelectScope: string;
  showAnswerKey: boolean;
  onShowAnswerKeyChange: (value: boolean) => void;
  questions: readonly { points: number }[];
  sheetCount: number;
  onClear: () => void;
  onBuild: () => void;
}) {
  const count = questions.length;
  const points = questions.map((question) => question.points);
  const minPoint = points.length > 0 ? Math.min(...points) : 0;
  const maxPoint = points.length > 0 ? Math.max(...points) : 0;

  const field =
    (key: keyof ExamPaperMeta) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onMetaChange((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Card className="lg:order-2 lg:sticky lg:top-20 lg:self-start">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sinav kurulumu</CardTitle>
        <CardDescription>Kagidin ust bilgisi bu alanlardan olusur.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Field id="exam-title" label="Sinav basligi">
          <Input id="exam-title" value={meta.title} onChange={field("title")} />
        </Field>

        <Field id="exam-lesson" label="Ders">
          <Input
            id="exam-lesson"
            value={meta.lesson}
            onChange={field("lesson")}
            placeholder="Derse girince otomatik dolar"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="exam-grade" label="Sinif">
            <Input
              id="exam-grade"
              value={meta.grade}
              onChange={field("grade")}
              placeholder="10-A"
            />
          </Field>

          <Field id="exam-duration" label="Sure (dk)">
            <Input
              id="exam-duration"
              type="number"
              min={5}
              step={5}
              value={meta.duration}
              onChange={field("duration")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="exam-date" label="Tarih">
            <Input
              id="exam-date"
              type="date"
              value={meta.date}
              onChange={field("date")}
            />
          </Field>

          <Field id="exam-school" label="Okul">
            <Input
              id="exam-school"
              value={meta.school}
              onChange={field("school")}
              placeholder="Opsiyonel"
            />
          </Field>
        </div>

        <Field id="exam-instructions" label="Yonerge">
          <Textarea
            id="exam-instructions"
            rows={3}
            value={meta.instructions}
            onChange={field("instructions")}
            className="resize-none text-sm"
          />
        </Field>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="exam-target">Otomatik secim</Label>
          <div className="flex gap-2">
            <Input
              id="exam-target"
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

        <dl className="space-y-1.5 text-sm">
          <SummaryRow label="Secili soru" value={`${count} soru`} />
          <SummaryRow
            label="Soru basina"
            value={
              count === 0
                ? "-"
                : minPoint === maxPoint
                  ? `${minPoint} puan`
                  : `${minPoint}-${maxPoint} puan`
            }
          />
          <SummaryRow
            label="Kagit"
            value={count === 0 ? "-" : `${sheetCount} yaprak`}
          />
        </dl>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={showAnswerKey}
            onChange={(event) => onShowAnswerKeyChange(event.target.checked)}
          />
          Cevap anahtarini ekle
        </label>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={count === 0} onClick={onBuild}>
            <FileText />
            Sinavi olustur
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={count === 0}
            onClick={onClear}
            aria-label="Secimi temizle"
          >
            <RotateCcw />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular">{value}</dd>
    </div>
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
          Icerik uzmani uretilen taslaklari onayladikca sorular burada ders ve
          konu basliklari altinda birikir.
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

/**
 * Ders kademesi tek bir "Ders atanmamis" kutusundan ibaretse, hiyerarside
 * ders yokmus gibi gorunur. Neden oyle oldugunu ve nasil bolunecegini burada
 * soyluyoruz - bos kutu kendi kendini aciklamiyor.
 */
function UnassignedHint() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <strong className="font-medium text-foreground">Ders atanmamis</strong>{" "}
        kutusundaki sorulara henuz ders bilgisi girilmemis. Icerik uzmani soru
        uretirken <strong className="font-medium text-foreground">Ders</strong>{" "}
        alanini doldurdukca bu kutu Biyoloji, Fizik gibi ayri ders
        kutucuklarina bolunur; konular da o derslerin altina yerlesir.
      </span>
    </p>
  );
}

function emptySubject(subject: string): SubjectGroup {
  return { subject, topics: [], questionCount: 0 };
}

/**
 * Arama ve tip filtresini ders -> konu -> soru agacina uygular.
 * Ders adi aramayla eslesiyorsa altindaki konular kirpilmaz; boylece
 * "Biyoloji" yazinca dersin tamami gorulebilir.
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
        !needle || subject.subject.toLocaleLowerCase("tr").includes(needle);

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
        questionCount: topics.reduce(
          (total, topic) => total + topic.questions.length,
          0,
        ),
      };
    })
    .filter((subject) => subject.topics.length > 0);
}

/** Yerel saat diliminde bugunun yyyy-aa-gg karsiligi. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
