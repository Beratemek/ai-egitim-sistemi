"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Library, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addExamQuestions,
  removeExamQuestion,
  setExamQuestionPoints,
} from "@/app/actions/exams";
import { QuestionBody } from "@/components/shared/question-body";
import { QuestionPoolBrowser } from "@/components/shared/question-pool-browser";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  const [pendingAction, setPendingAction] = React.useState<string | null>(null);

  const inExamIds = React.useMemo(
    () => new Set(examQuestions.map((question) => question.id)),
    [examQuestions],
  );

  /**
   * Havuzdan, bu sinavda ZATEN ekli olanlar cikarilmis hali.
   *
   * Arama/filtre burada YAPILMAZ: onlar QuestionPoolBrowser'in kendi ust
   * cubugunda, ders/konu gezintisiyle birlikte duruyor.
   */
  const available = React.useMemo(
    () => pool.filter((question) => !inExamIds.has(question.id)),
    [pool, inExamIds],
  );

  /** Gezginde isaretlenen sorulari bu sinava ekler. */
  async function handleAdd(questionIds: string[]) {
    if (questionIds.length === 0) return;

    setPendingAction("add");
    const result = await addExamQuestions(exam.id, questionIds);
    setPendingAction(null);

    if (!result.ok) {
      toast.error("Sorular eklenemedi", { description: result.error });
      return;
    }

    toast.success(`${result.data.added} soru sınava eklendi`);
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
              <div key={question.id} className="rounded-xl border p-4">
                {/*
                  SORU TAM GOVDESIYLE CIZILIR (QuestionBody).

                  Onceden yalnizca soru METNI tek satirda duruyordu. 100
                  soruluk bir sinavda liste birbirine benzeyen tek satirlik
                  cumlelere donusuyor, egitmen hangi soruyu cikaracagini
                  metinden ayirt edemiyordu; siklari gormeden "bu soru
                  duzgun mu" karari verilemiyordu.

                  Ayni bilesen sinav kontrolu ekraninda da kullaniliyor;
                  boylece soru NEREDE gorunurse gorunsun ayni bicimde
                  okunur. revealAnswer: burasi egitmen ekrani, dogru sik
                  isaretli gelmeli. showRubric: acik uclu sorunun puanlama
                  olcutu de burada gorunur.
                */}
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <QuestionBody
                      question={question}
                      number={index + 1}
                      topic={question.topic}
                      points={question.points}
                      revealAnswer
                      showRubric
                    />
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

        <CardContent>
          {/*
            HAVUZUN KENDISI BURAYA TASINDI (duz liste kaldirildi).

            Onceden burada yalnizca bir arama kutusu ve butun onayli
            sorularin alt alta dizildigi duz bir liste vardi. Havuz
            buyudukce (uzun metinli yuzlerce soru) bu liste kullanilamaz
            hale geliyordu ve en onemlisi: soru havuzunda kurulan
            DERS -> KONU kategori yapisi bu ekranda hic gorunmuyordu.

            Artik soru havuzu sayfasindaki gezginin TA KENDISI kullaniliyor
            (QuestionPoolBrowser): ayni ders/konu kutucuklari, ayni
            breadcrumb, ayni tip filtresi ve toplu secim. Tek fark
            `onAddToExam`: secim yeni sinav kurmak yerine ACIK OLAN sinava
            eklenir.

            Sinavda zaten bulunan sorular gezgine hic verilmez; boylece
            "ekli olan" sorular listede tekrar gorunmez.
          */}
          {available.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
              <Library className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium">
                {pool.length === 0
                  ? "Havuzda onaylı soru yok"
                  : "Eklenebilecek başka soru kalmadı"}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {pool.length === 0
                  ? "Önce soru havuzundan taslakları onaylayın; onaylanan sorular ders ve konu başlıkları altında burada birikir."
                  : "Havuzdaki onaylı soruların tamamı bu sınavda ekli."}
              </p>
            </div>
          ) : (
            <QuestionPoolBrowser
              questions={available}
              canPersist={canPersist}
              onAddToExam={handleAdd}
            />
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
