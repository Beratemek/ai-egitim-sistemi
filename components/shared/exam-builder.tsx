"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addExamQuestions,
  removeExamQuestion,
  setExamQuestionPoints,
} from "@/app/actions/exams";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Exam, Question } from "@/lib/types";

export interface ExamBuilderProps {
  exam: Exam;
  /** Sınavda bulunan sorular, `position` sırasında; puanlariyla birlikte. */
  examQuestions: readonly (Question & { points: number; position: number })[];
  /** Havuzdaki onaylı sorular; bilesen sınavda olanlari kendisi ayiklar. */
  pool: readonly Question[];
  /** Sınava cevap verilmis mi? Verilmisse soru cikarma konusunda uyarilir. */
  hasSubmissions: boolean;
  /**
   * Supabase yapilandirilmis mi? Demo modunda butonlar tiklanabilir kalir ve
   * gerekçe hata mesajinda gösterilir - sessizce devre disi buton yerine.
   */
  canPersist?: boolean;
}

/**
 * Sınav kurma ekrani: havuzdan soru ekle / çıkar, soru puanlarini ayarla.
 *
 * Yalnızca Onaylı sorular eklenebilir; taslak veya reddedilmis soru sınava
 * girmemeli ("onaylanan sorular havuza alınır; seçilerek sınav seti oluşturulur").
 *
 * YAYINA ALMA BURADA DEGIL: eskiden bu bilesenin en ustunde duruyordu ve
 * sinav detay sayfasinda ayarlarin, sinif atamasinin ardindan uc dev panelin
 * ortasina gomuluyordu - egitmen sinavin birincil eylemine ulasmak icin
 * kaydirmak zorundaydi. Artik sayfanin tepesindeki yapiskan durum seridinde
 * ve hangi sekmede olursa olsun gorunur (bkz. exam-detail-tabs.tsx).
 */
export function ExamBuilder({
  exam,
  examQuestions,
  pool,
  hasSubmissions,
  canPersist = true,
}: ExamBuilderProps) {
  const router = useRouter();

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState("");
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  const inExamIds = React.useMemo(
    () => new Set(examQuestions.map((question) => question.id)),
    [examQuestions],
  );

  const available = React.useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");

    return pool.filter((question) => {
      if (inExamIds.has(question.id)) return false;
      if (!needle) return true;
      return (
        question.text.toLocaleLowerCase("tr").includes(needle) ||
        question.topic.toLocaleLowerCase("tr").includes(needle)
      );
    });
  }, [pool, inExamIds, search]);

  function toggle(questionId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  async function handleAdd() {
    setPendingAction("add");
    const result = await addExamQuestions(exam.id, [...selected]);
    setPendingAction(null);

    if (!result.ok) {
      toast.error("Sorular eklenemedi", { description: result.error });
      return;
    }

    toast.success(`${result.data.added} soru sınava eklendi`);
    setSelected(new Set());
    router.refresh();
  }

  async function handleRemove(question: Question) {
    setPendingAction(question.id);
    const result = await removeExamQuestion(exam.id, question.id);
    setPendingAction(null);

    if (!result.ok) {
      toast.error("Soru çıkarılamadı", { description: result.error });
      return;
    }

    toast.success("Soru sınavdan çıkarıldı", {
      description: "Havuzdaki soru silinmedi, yalnızca bu sınavdan kaldırıldı.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ---------- Sınavdaki sorular ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Sınavdaki sorular</CardTitle>
          <CardDescription>
            {examQuestions.length === 0
              ? "Henüz soru eklenmedi. Aşağıdaki havuzdan seçim yapın."
              : `Öğrenciye bu sırayla gösterilir. ${examQuestions.length} soru · toplam ${examQuestions.reduce((sum, q) => sum + q.points, 0)} puan.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {examQuestions.length === 0 ? (
            <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
              Sınav boş.
            </p>
          ) : (
            examQuestions.map((question, index) => (
              <div
                key={question.id}
                className="flex items-start gap-3 rounded-xl border p-4"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium leading-relaxed">{question.text}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <QuestionTypeBadge type={question.type} />
                    <span className="text-xs text-muted-foreground">
                      {question.topic}
                    </span>
                  </div>
                </div>

                <PuanAlani
                  examId={exam.id}
                  questionId={question.id}
                  points={question.points}
                  disabled={pendingAction !== null}
                  canPersist={canPersist}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                  disabled={pendingAction === question.id}
                  onClick={() => void handleRemove(question)}
                >
                  {pendingAction === question.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Çıkar
                </Button>
              </div>
            ))
          )}

          {canPersist ? null : (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Tanıtım modu: bu ekrandaki değişiklikler kaydedilmez.
            </p>
          )}

          {hasSubmissions && examQuestions.length > 0 ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Bu sınava cevap verilmiş. Soru çıkarmak verilen cevapları silmez ama
              istatistikleri değiştirir.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------- Havuzdan ekle ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Havuzdan soru ekle</CardTitle>
          <CardDescription>
            Yalnızca eğitmen onayından geçmiş sorular listelenir.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Soru veya konu ara..."
                aria-label="Havuzda ara"
                className="pl-9"
              />
            </div>

            <Button
              className="gap-2"
              disabled={selected.size === 0 || pendingAction === "add"}
              onClick={() => void handleAdd()}
            >
              {pendingAction === "add" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {selected.size > 0 ? `${selected.size} soruyu ekle` : "Soru ekle"}
            </Button>
          </div>

          <Separator />

          {available.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {pool.length === 0
                ? "Havuzda onaylı soru yok. Önce soru havuzundan taslakları onaylayın."
                : "Eklenebilecek başka soru kalmadı."}
            </p>
          ) : (
            <ul className="space-y-2">
              {available.map((question) => {
                const isSelected = selected.has(question.id);

                return (
                  <li key={question.id}>
                    <button
                      type="button"
                      onClick={() => toggle(question.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40 hover:bg-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input",
                        )}
                        aria-hidden
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>

                      <span className="min-w-0 flex-1 space-y-2">
                        <span className="block text-sm font-medium leading-relaxed">
                          {question.text}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <QuestionTypeBadge type={question.type} />
                          <span className="text-xs text-muted-foreground">
                            {question.topic}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Sorunun bu sinavdaki puani.
 *
 * Puan soruya degil SINAVA ozeldir (exam_questions): ayni soru bir sinavda
 * 5, digerinde 20 puan olabilir. Her tus vurusunda kaydetmek gereksiz istek
 * uretirdi; kaydetme yalnizca deger degistiginde etkinlesir ve Enter da
 * calisir.
 */
function PuanAlani({
  examId,
  questionId,
  points,
  disabled,
  canPersist,
}: {
  examId: string;
  questionId: string;
  points: number;
  disabled: boolean;
  canPersist: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(String(points));
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setDraft(String(points)), [points]);

  const dirty = draft.trim() !== String(points);

  async function kaydet() {
    if (!canPersist) {
      toast.error("Tanıtım modunda kayıt yapılmaz");
      return;
    }

    const deger = Number.parseInt(draft.trim(), 10);
    if (!Number.isFinite(deger) || deger < 1 || deger > 100) {
      toast.error("Puan 1 ile 100 arasında olmalı");
      setDraft(String(points));
      return;
    }

    setPending(true);
    try {
      const result = await setExamQuestionPoints(examId, questionId, deger);
      if (!result.ok) throw new Error(result.error);

      toast.success(`Puan: ${result.data.points}`);
      router.refresh();
    } catch (caught) {
      setDraft(String(points));
      toast.error("Puan kaydedilemedi", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Input
        type="number"
        min={1}
        max={100}
        inputMode="numeric"
        value={draft}
        disabled={disabled || pending}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) void kaydet();
        }}
        aria-label="Soru puanı"
        className="h-9 w-16 text-center"
      />
      <span className="text-xs text-muted-foreground">puan</span>

      {dirty ? (
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={pending}
          onClick={() => void kaydet()}
          aria-label="Puanı kaydet"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}
