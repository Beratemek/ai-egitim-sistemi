"use client";

import * as React from "react";
import {
  Check,
  ChevronRight,
  FolderOpen,
  Layers,
  Search,
  Sparkles,
  UserPen,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { updateQuestionStatus } from "@/app/actions/questions";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countByType,
  formatTypeCounts,
  groupBySubject,
  UNASSIGNED_SUBJECT,
} from "@/lib/question-pool";
import {
  QUESTION_TYPES,
  type Question,
  type QuestionStatus,
  type QuestionType,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * İçerik uzmaninin soru havuzu onayi.
 *
 * DUZEN: Durum -> Ders -> Konu -> Soru.
 *
 * Onceki surum 329 soruyu tek bir duz tabloda gosteriyordu: her satirda sekiz
 * kolon (soru, dal, ders, konu, tip, durum, kaynak, islem) ve satirlar
 * arasinda hicbir gruplama yoktu. Ayni konunun sekiz sorusu, araya baska
 * derslerin sorulari karisarak dagiliyordu; uzman "Mezopotamya'yi bitirdim
 * mi" sorusunu yanitlayamiyordu. Kolonlarin cogu da satirdan satira ayni
 * degeri tekrar ediyordu (Tarih, Tarih, Tarih...).
 *
 * Simdi hiyerarsi acilir kapanir kademeler halinde: once IS OLAN kume (onay
 * bekleyenler), altinda dersler, onlarin altinda konular. Tekrar eden bilgi
 * satirdan cikip basliga tasindi.
 */

type TypeFilter = QuestionType | "hepsi";

const TYPE_LABELS: Record<QuestionType, string> = {
  test: "Çoktan seçmeli",
  acik_uclu: "Açık uçlu",
};

/**
 * Bir kademe kac soruya kadar ACIK baslar?
 *
 * Tek kural, her kademede ayni: kucuk kumeler acik, buyukler kapali gelir.
 * 14 bekleyen soru en alt kademeye kadar acilir - uzman girer girmez isini
 * gorur. 315 onayli soru kapali gelir, yoksa sayfa bir duvara donerdi.
 */
const AUTO_OPEN_LIMIT = 20;

interface StatusSection {
  status: QuestionStatus;
  label: string;
  /** Bu kume her zaman acik baslar; yapilacak is burada. */
  alwaysOpen?: boolean;
}

const STATUS_SECTIONS: readonly StatusSection[] = [
  { status: "taslak", label: "Onay bekleyen", alwaysOpen: true },
  { status: "onayli", label: "Onaylı" },
  { status: "reddedildi", label: "Reddedilen" },
];

export interface QuestionApprovalBoardProps {
  questions: readonly Question[];
  /**
   * true ise onay/red veritabanina yazilir (server action).
   * false ise degisiklik yalnizca bilesen icinde kalir - tanitim modu.
   */
  persist?: boolean;
}

export function QuestionApprovalBoard({
  questions,
  persist = false,
}: QuestionApprovalBoardProps) {
  const [rows, setRows] = React.useState<readonly Question[]>(questions);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  /**
   * Kullanicinin ELLE actigi/kapattigi kademeler.
   *
   * Varsayilan durum `AUTO_OPEN_LIMIT` kuralindan hesaplanir; burada yalnizca
   * kuralin EZILDIGI kademeler tutulur. Boylece filtre degisip gruplar
   * yeniden olustugunda varsayilan davranis kendiliginden dogru kalir.
   */
  const [overrides, setOverrides] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setRows(questions);
  }, [questions]);

  const needle = search.trim().toLocaleLowerCase("tr");
  // Arama sirasinda her kademe acilir; yoksa eslesen soru kapali bir
  // kutunun icinde kalir ve arama hicbir sey bulmamis gibi gorunur.
  const searching = needle.length > 0;

  const visible = React.useMemo(() => {
    return rows.filter((question) => {
      if (typeFilter !== "hepsi" && question.type !== typeFilter) return false;
      if (!needle) return true;

      return (
        question.text.toLocaleLowerCase("tr").includes(needle) ||
        question.topic.toLocaleLowerCase("tr").includes(needle) ||
        (question.subject ?? "").toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [rows, needle, typeFilter]);

  /** Durum -> ders -> konu agaci. Bos durum kumeleri de listelenir. */
  const sections = React.useMemo(
    () =>
      STATUS_SECTIONS.map((section) => {
        const items = visible.filter((question) => question.status === section.status);
        return { ...section, questions: items, subjects: groupBySubject(items) };
      }),
    [visible],
  );

  function isOpen(key: string, count: number, force = false): boolean {
    const override = overrides[key];
    if (override !== undefined) return override;
    return force || searching || count <= AUTO_OPEN_LIMIT;
  }

  function toggle(key: string, current: boolean) {
    setOverrides((prev) => ({ ...prev, [key]: !current }));
  }

  /** Tum kademeleri ac ya da kapat. */
  function setAll(open: boolean) {
    const next: Record<string, boolean> = {};
    for (const section of sections) {
      next[`d:${section.status}`] = open;
      for (const subject of section.subjects) {
        next[`s:${section.status}:${subject.subject}`] = open;
        for (const topic of subject.topics) {
          next[`k:${section.status}:${subject.subject}:${topic.topic}`] = open;
        }
      }
    }
    setOverrides(next);
  }

  async function updateStatus(question: Question, status: QuestionStatus) {
    setPendingId(question.id);
    const previous = rows;

    // Iyimser guncelleme: once arayuz, sonra kalici katman.
    setRows((current) =>
      current.map((row) =>
        row.id === question.id
          ? { ...row, status, updated_at: new Date().toISOString() }
          : row,
      ),
    );

    try {
      if (persist) {
        const result = await updateQuestionStatus(question.id, status);
        if (!result.ok) throw new Error(result.error);
      }

      toast.success(status === "onayli" ? "Soru havuza eklendi" : "Soru reddedildi", {
        description: `${question.text.slice(0, 70)}...`,
      });
    } catch (caught) {
      setRows(previous); // basarisiz olursa geri al
      toast.error("İşlem kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------- Filtreler ---------- */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Soru, ders veya konu ara..."
            aria-label="Soru ara"
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as TypeFilter)}
        >
          <SelectTrigger className="sm:w-48" aria-label="Tipe göre filtrele">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hepsi">Tüm soru tipleri</SelectItem>
            {QUESTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {visible.length} / {rows.length} soru
          {searching || typeFilter !== "hepsi" ? " (filtreli)" : ""}
        </p>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setAll(true)}
          >
            Tümünü aç
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => setAll(false)}
          >
            Tümünü kapat
          </Button>
        </div>
      </div>

      {visible.length === 0 ? <EmptyState /> : null}

      {/* ---------- Durum kademeleri ---------- */}
      {sections.map((section) => {
        if (section.questions.length === 0) return null;

        const key = `d:${section.status}`;
        const open = isOpen(key, section.questions.length, section.alwaysOpen);

        return (
          <Card key={section.status} className="overflow-hidden">
            <DisclosureRow
              open={open}
              onToggle={() => toggle(key, open)}
              className="bg-muted/40 px-4 py-3"
            >
              <StatusDot status={section.status} />
              <span className="font-semibold">{section.label}</span>
              <Badge variant="soft" className="font-semibold">
                {section.questions.length}
              </Badge>
              <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                {section.subjects.length} ders ·{" "}
                {formatTypeCounts(countByType(section.questions))}
              </span>
            </DisclosureRow>

            {open ? (
              <div className="divide-y border-t">
                {section.subjects.map((subject) => {
                  const subKey = `s:${section.status}:${subject.subject}`;
                  const subOpen = isOpen(subKey, subject.questionCount);

                  return (
                    <div key={subject.subject}>
                      <DisclosureRow
                        open={subOpen}
                        onToggle={() => toggle(subKey, subOpen)}
                        className="px-4 py-2.5"
                      >
                        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span
                          className={cn(
                            "font-medium",
                            subject.subject === UNASSIGNED_SUBJECT &&
                              "text-muted-foreground",
                          )}
                        >
                          {subject.subject}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {subject.questionCount} soru · {subject.topics.length} konu
                        </span>

                      </DisclosureRow>

                      {subOpen ? (
                        <div className="space-y-1 border-t bg-muted/20 py-1 pl-4">
                          {subject.topics.map((topic) => {
                            const topKey = `k:${section.status}:${subject.subject}:${topic.topic}`;
                            const topOpen = isOpen(topKey, topic.questions.length);

                            return (
                              <div key={topic.topic}>
                                <DisclosureRow
                                  open={topOpen}
                                  onToggle={() => toggle(topKey, topOpen)}
                                  className="px-3 py-2"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    {topic.topic}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTypeCounts(countByType(topic.questions))}
                                  </span>
                                </DisclosureRow>

                                {topOpen ? (
                                  <ul className="space-y-2 py-2 pl-6 pr-3">
                                    {topic.questions.map((question, index) => (
                                      <li key={question.id}>
                                        <QuestionRow
                                          question={question}
                                          index={index}
                                          pending={pendingId === question.id}
                                          onUpdate={updateStatus}
                                        />
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Acilir kapanir baslik satiri.
 *
 * Uc kademe de ayni bileseni kullanir: ok isareti hep ayni yerde doner,
 * kullanici hangi kademede oldugundan bagimsiz ayni jesti ogrenir.
 */
function DisclosureRow({
  open,
  onToggle,
  className,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-2 text-left transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <ChevronRight
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-90",
        )}
      />
      {children}
    </button>
  );
}

/** Durum kumesinin renk noktasi; rozet tekrar etmesin diye sade. */
function StatusDot({ status }: { status: QuestionStatus }) {
  const renk =
    status === "onayli"
      ? "bg-success"
      : status === "reddedildi"
        ? "bg-destructive"
        : "bg-warning";

  return <span className={cn("h-2 w-2 shrink-0 rounded-full", renk)} aria-hidden />;
}

/**
 * Tek soru karti.
 *
 * Soru TAM HALIYLE okunur: metin, siklar ve dogru cevap acilip kapanmadan
 * ekranda. Uzmanin isi soruyu tane tane okuyup karar vermek; her soru icin
 * once "detayi ac" tiklamak o isi iki katina cikariyordu. Eski tabloda
 * siklar bir aciliş satirinin arkasindaydi, yani onaylanan sorularin cogu
 * hic okunmadan onaylanabiliyordu.
 *
 * Yerlesim, uretim ekranindaki taslak kartiyla AYNI: sabit genislikte oluk
 * (sira numarasi) + tek icerik sutunu. Ayni soru iki ekranda ayni bicimde
 * gorunsun diye - uzman uretimde alistigi duzeni burada da buluyor.
 *
 * Ders/konu/durum bilgisi UST KADEMELERDE yaziyor, kartta tekrar edilmez -
 * eski tablodaki en buyuk gurultu kaynagi buydu.
 */
function QuestionRow({
  question,
  index,
  pending,
  onUpdate,
}: {
  question: Question;
  index: number;
  pending: boolean;
  onUpdate: (question: Question, status: QuestionStatus) => Promise<void>;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3">
      {/* Sabit oluk: sira numarasi. Soru metinleri ayni hizadan baslasin. */}
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <QuestionTypeBadge type={question.type} />
          <SourceBadge aiGenerated={question.ai_generated} />
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDateTime(question.updated_at)}
          </span>
        </div>

        <p className="font-medium leading-relaxed">{question.text}</p>

        <QuestionBody question={question} />

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            size="sm"
            variant={question.status === "onayli" ? "ghost" : "default"}
            disabled={pending || question.status === "onayli"}
            onClick={() => void onUpdate(question, "onayli")}
            className="h-8 gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {question.status === "onayli" ? "Onaylandı" : "Onayla"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || question.status === "reddedildi"}
            onClick={() => void onUpdate(question, "reddedildi")}
            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            {question.status === "reddedildi" ? "Reddedildi" : "Reddet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ aiGenerated }: { aiGenerated: boolean }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
      {aiGenerated ? (
        <Sparkles className="h-3.5 w-3.5" />
      ) : (
        <UserPen className="h-3.5 w-3.5" />
      )}
      {aiGenerated ? "AI" : "Manuel"}
    </Badge>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center min-h-[240px]">
        <Search className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Filtrelere uyan soru bulunamadı</p>
        <p className="text-sm text-muted-foreground">
          Arama terimini veya filtreleri değiştirmeyi deneyin.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Sorunun govdesi: siklar ya da rubrik.
 *
 * "Secenekler" basligi KALDIRILDI - siklar zaten A) B) C) ile kendini
 * anlatiyor, her soruda bir kez daha yazmak listeyi uzatiyordu. Rubrik
 * basligi duruyor cunku duz metin oldugu icin ne oldugu belli degil.
 */
function QuestionBody({ question }: { question: Question }) {
  if (question.type === "test") {
    return (
      <div className="space-y-2">
        <ul className="space-y-1">
          {(question.options_json ?? []).map((option) => {
            const isCorrect = option.key === question.correct_answer;

            return (
              <li
                key={option.key}
                className={cn(
                  "flex gap-2 rounded-md px-2 py-1.5 text-sm leading-relaxed",
                  isCorrect
                    ? "bg-success/10 font-medium text-success"
                    : "text-muted-foreground",
                )}
              >
                <span className="w-4 shrink-0 font-mono text-xs leading-relaxed opacity-70">
                  {option.key})
                </span>
                <span className="min-w-0 flex-1">{option.text}</span>
                {isCorrect ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-label="Doğru cevap" />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rubrik
      </p>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
        {question.rubric ?? "Rubrik tanımlanmamış."}
      </pre>
    </div>
  );
}
