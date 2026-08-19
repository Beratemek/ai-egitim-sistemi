"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuestionStatusBadge, QuestionTypeBadge } from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/utils";
import {
  QUESTION_STATUSES,
  QUESTION_TYPES,
  type Question,
  type QuestionStatus,
  type QuestionType,
} from "@/lib/types";

type StatusFilter = QuestionStatus | "hepsi";
type TypeFilter = QuestionType | "hepsi";

export interface QuestionPoolTableProps {
  /** Baslangic verisi. Su an mock; Supabase'e gecerken sunucudan gecirin. */
  questions: readonly Question[];
  /**
   * Durum degisikligini kalici hale getirir. Verilmezse degisiklik yalnizca
   * bilesen icindeki state'te tutulur (mock demo davranisi).
   */
  onStatusChange?: (questionId: string, status: QuestionStatus) => Promise<void> | void;
}

const STATUS_LABELS: Record<QuestionStatus, string> = {
  taslak: "Taslak",
  onayli: "Onayli",
  reddedildi: "Reddedildi",
};

const TYPE_LABELS: Record<QuestionType, string> = {
  test: "Coktan secmeli",
  acik_uclu: "Acik uclu",
};

export function QuestionPoolTable({ questions, onStatusChange }: QuestionPoolTableProps) {
  const [rows, setRows] = React.useState<readonly Question[]>(questions);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("hepsi");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("hepsi");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Sunucudan gelen veri degisirse tabloyu tazele.
  React.useEffect(() => {
    setRows(questions);
  }, [questions]);

  const visibleRows = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");

    return rows.filter((question) => {
      if (statusFilter !== "hepsi" && question.status !== statusFilter) return false;
      if (typeFilter !== "hepsi" && question.type !== typeFilter) return false;
      if (!needle) return true;

      return (
        question.text.toLocaleLowerCase("tr").includes(needle) ||
        question.topic.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [rows, search, statusFilter, typeFilter]);

  const counts = React.useMemo(
    () => ({
      toplam: rows.length,
      taslak: rows.filter((q) => q.status === "taslak").length,
      onayli: rows.filter((q) => q.status === "onayli").length,
      reddedildi: rows.filter((q) => q.status === "reddedildi").length,
    }),
    [rows],
  );

  async function updateStatus(questionId: string, status: QuestionStatus) {
    setPendingId(questionId);
    // Iyimser guncelleme: once arayuz, sonra kalici katman.
    const previous = rows;
    setRows((current) =>
      current.map((question) =>
        question.id === questionId
          ? { ...question, status, updated_at: new Date().toISOString() }
          : question,
      ),
    );

    try {
      await onStatusChange?.(questionId, status);
    } catch {
      setRows(previous); // basarisiz olursa geri al
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Ozet + filtreler */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="border-border">
            Toplam {counts.toplam}
          </Badge>
          <Badge variant="secondary">Taslak {counts.taslak}</Badge>
          <Badge variant="success">Onayli {counts.onayli}</Badge>
          <Badge variant="destructive">Reddedildi {counts.reddedildi}</Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Soru veya konu ara..."
            aria-label="Soru ara"
            className="sm:w-64"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            aria-label="Duruma gore filtrele"
            className="sm:w-44"
          >
            <option value="hepsi">Tum durumlar</option>
            {QUESTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            aria-label="Tipe gore filtrele"
            className="sm:w-44"
          >
            <option value="hepsi">Tum tipler</option>
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Tablo */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[38%]">Soru</TableHead>
              <TableHead>Konu</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kaynak</TableHead>
              <TableHead>Guncelleme</TableHead>
              <TableHead className="text-right">Islem</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Filtrelere uyan soru bulunamadi.
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((question) => {
                const isExpanded = expandedId === question.id;
                const isPending = pendingId === question.id;

                return (
                  <React.Fragment key={question.id}>
                    <TableRow>
                      <TableCell className="max-w-md">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : question.id)}
                          className="text-left font-medium hover:underline"
                          aria-expanded={isExpanded}
                        >
                          {question.text}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{question.topic}</TableCell>
                      <TableCell>
                        <QuestionTypeBadge type={question.type} />
                      </TableCell>
                      <TableCell>
                        <QuestionStatusBadge status={question.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {question.ai_generated ? "AI uretimi" : "Manuel"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(question.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending || question.status === "onayli"}
                            onClick={() => void updateStatus(question.id, "onayli")}
                          >
                            Onayla
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending || question.status === "reddedildi"}
                            onClick={() => void updateStatus(question.id, "reddedildi")}
                          >
                            Reddet
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isExpanded ? (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={7} className="py-4">
                          <QuestionDetail question={question} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function QuestionDetail({ question }: { question: Question }) {
  if (question.type === "test") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Secenekler
        </p>
        <ul className="space-y-1">
          {(question.options_json ?? []).map((option) => {
            const isCorrect = option.key === question.correct_answer;
            return (
              <li
                key={option.key}
                className={
                  isCorrect
                    ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-sm text-foreground"
                }
              >
                <span className="mr-2 font-mono">{option.key})</span>
                {option.text}
                {isCorrect ? <span className="ml-2 text-xs">(dogru cevap)</span> : null}
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
        Puanlama rubrigi
      </p>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
        {question.rubric ?? "Rubrik tanimlanmamis."}
      </pre>
    </div>
  );
}
