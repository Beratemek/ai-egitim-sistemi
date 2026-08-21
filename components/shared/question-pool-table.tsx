"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Search,
  Sparkles,
  UserPen,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { updateQuestionStatus } from "@/app/actions/questions";

import {
  QuestionStatusBadge,
  QuestionTypeBadge,
} from "@/components/shared/status-badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DENEYAP_CATEGORY_OPTIONS,
  categoryLabel,
  type DeneyapCategory,
} from "@/lib/deneyap";
import { UNASSIGNED_SUBJECT } from "@/lib/question-pool";
import { cn, formatDateTime } from "@/lib/utils";
import {
  QUESTION_TYPES,
  type Question,
  type QuestionStatus,
  type QuestionType,
} from "@/lib/types";

type StatusFilter = QuestionStatus | "hepsi";
type TypeFilter = QuestionType | "hepsi";
type CategoryFilter = DeneyapCategory | "hepsi";

export interface QuestionPoolTableProps {
  /** Başlangıç verisi. Su an mock; Supabase'e gecerken sunucudan gecirin. */
  questions: readonly Question[];
  /**
   * true ise onay/red veritabanına yazilir (server action).
   * false ise degisiklik yalnızca bilesen icindeki state'te kalir - demo modu.
   */
  persist?: boolean;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  test: "Çoktan seçmeli",
  acik_uclu: "Açık uçlu",
};

const STATUS_TABS: readonly { value: StatusFilter; label: string }[] = [
  { value: "hepsi", label: "Tümü" },
  { value: "taslak", label: "Taslak" },
  { value: "onayli", label: "Onaylı" },
  { value: "reddedildi", label: "Reddedildi" },
];

export function QuestionPoolTable({
  questions,
  persist = false,
}: QuestionPoolTableProps) {
  const [rows, setRows] = React.useState<readonly Question[]>(questions);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("hepsi");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("hepsi");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(questions);
  }, [questions]);

  const visibleRows = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");

    return rows.filter((question) => {
      if (statusFilter !== "hepsi" && question.status !== statusFilter) return false;
      if (typeFilter !== "hepsi" && question.type !== typeFilter) return false;
      if (categoryFilter !== "hepsi" && question.category !== categoryFilter) return false;
      if (!needle) return true;

      return (
        question.text.toLocaleLowerCase("tr").includes(needle) ||
        question.topic.toLocaleLowerCase("tr").includes(needle) ||
        (question.subject ?? "").toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [rows, search, statusFilter, typeFilter, categoryFilter]);

  const counts = React.useMemo(
    () => ({
      hepsi: rows.length,
      taslak: rows.filter((q) => q.status === "taslak").length,
      onayli: rows.filter((q) => q.status === "onayli").length,
      reddedildi: rows.filter((q) => q.status === "reddedildi").length,
    }),
    [rows],
  );

  async function updateStatus(question: Question, status: QuestionStatus) {
    setPendingId(question.id);
    const previous = rows;

    // Iyimser guncelleme: önce arayuz, sonra kalici katman.
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
        description: caught instanceof Error ? caught.message : "Lutfen tekrar deneyin.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---------- Filtre cubugu ---------- */}
      <div className="flex flex-col gap-3">
        <Tabs
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.label}
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {counts[tab.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

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
            <SelectTrigger className="sm:w-52" aria-label="Tipe gore filtrele">
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

          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
          >
            <SelectTrigger className="sm:w-64" aria-label="Atolye dalina gore filtrele">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hepsi">Tüm atölye dalları</SelectItem>
              {DENEYAP_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ---------- Masaustu: tablo ---------- */}
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[30%]">Soru</TableHead>
                  <TableHead>Atölye dalı</TableHead>
                  <TableHead>Ders</TableHead>
                  <TableHead>Konu</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead className="text-right">Islem</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visibleRows.map((question) => {
                  const isExpanded = expandedId === question.id;

                  return (
                    <React.Fragment key={question.id}>
                      <TableRow>
                        <TableCell className="max-w-md align-top">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isExpanded ? null : question.id)
                            }
                            className="group flex items-start gap-2 text-left"
                            aria-expanded={isExpanded}
                          >
                            <ChevronDown
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                isExpanded && "rotate-180",
                              )}
                            />
                            <span className="font-medium group-hover:underline">
                              {question.text}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="soft" className="font-normal">
                            {categoryLabel(question.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {question.subject || UNASSIGNED_SUBJECT}
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground">
                          {question.topic}
                        </TableCell>
                        <TableCell className="align-top">
                          <QuestionTypeBadge type={question.type} />
                        </TableCell>
                        <TableCell className="align-top">
                          <QuestionStatusBadge status={question.status} />
                        </TableCell>
                        <TableCell className="align-top">
                          <SourceBadge aiGenerated={question.ai_generated} />
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <RowActions
                            question={question}
                            pending={pendingId === question.id}
                            onUpdate={updateStatus}
                          />
                        </TableCell>
                      </TableRow>

                      {isExpanded ? (
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={8} className="py-4">
                            <QuestionDetail question={question} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* ---------- Mobil: kart listesi ---------- */}
          <div className="space-y-3 md:hidden">
            {visibleRows.map((question) => {
              const isExpanded = expandedId === question.id;

              return (
                <Card key={question.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <QuestionStatusBadge status={question.status} />
                      <QuestionTypeBadge type={question.type} />
                      <Badge variant="soft" className="font-normal">
                        {categoryLabel(question.category)}
                      </Badge>
                    </div>

                    <p className="text-sm font-medium leading-relaxed">
                      {question.text}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{question.subject || UNASSIGNED_SUBJECT}</span>
                      <span aria-hidden>&middot;</span>
                      <span>{question.topic}</span>
                      <span aria-hidden>&middot;</span>
                      <span>{formatDateTime(question.updated_at)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : question.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary"
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                      {isExpanded ? "Detayı gizle" : "Seçenekler / rubrik"}
                    </button>

                    {isExpanded ? (
                      <div className="rounded-lg bg-muted/50 p-3">
                        <QuestionDetail question={question} />
                      </div>
                    ) : null}

                    <RowActions
                      question={question}
                      pending={pendingId === question.id}
                      onUpdate={updateStatus}
                      className="pt-1"
                      fullWidth
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {visibleRows.length} / {rows.length} soru gösteriliyor
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RowActions({
  question,
  pending,
  onUpdate,
  className,
  fullWidth = false,
}: {
  question: Question;
  pending: boolean;
  onUpdate: (question: Question, status: QuestionStatus) => Promise<void>;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex gap-2", fullWidth ? "w-full" : "justify-end", className)}>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || question.status === "onayli"}
        onClick={() => void onUpdate(question, "onayli")}
        className={cn("gap-1.5", fullWidth && "flex-1")}
      >
        <Check className="h-3.5 w-3.5" />
        Onayla
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || question.status === "reddedildi"}
        onClick={() => void onUpdate(question, "reddedildi")}
        className={cn(
          "gap-1.5 text-muted-foreground hover:text-destructive",
          fullWidth && "flex-1",
        )}
      >
        <X className="h-3.5 w-3.5" />
        Reddet
      </Button>
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
      <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Search className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-medium">Filtrelere uyan soru bulunamadi</p>
        <p className="text-sm text-muted-foreground">
          Arama terimini veya filtreleri degistirmeyi deneyin.
        </p>
      </CardContent>
    </Card>
  );
}

function QuestionDetail({ question }: { question: Question }) {
  if (question.type === "test") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Seçenekler
        </p>
        <ul className="space-y-1.5">
          {(question.options_json ?? []).map((option) => {
            const isCorrect = option.key === question.correct_answer;

            return (
              <li
                key={option.key}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                  isCorrect && "bg-success/10 font-medium text-success",
                )}
              >
                <span className="font-mono text-xs opacity-70">{option.key})</span>
                <span>{option.text}</span>
                {isCorrect ? (
                  <Check className="ml-auto h-4 w-4 shrink-0" aria-label="Dogru cevap" />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Puanlama rubriği
      </p>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
        {question.rubric ?? "Rubrik tanımlanmamış."}
      </pre>
    </div>
  );
}
