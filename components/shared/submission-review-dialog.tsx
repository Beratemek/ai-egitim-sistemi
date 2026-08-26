"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { approveSubmission } from "@/app/actions/submissions";
import {
  QuestionBody,
  StudentAnswerBlock,
} from "@/components/shared/question-body";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  puanGosterimi,
  puandanYuzdeye,
  yuzdedenPuana,
} from "@/lib/score-scale";
import type { Question, Submission } from "@/lib/types";

export interface SubmissionReviewDialogProps {
  submission: Submission;
  /** Öğrenci adi - baslikta gösterilir. */
  studentName: string;
  /**
   * Cevabın ait oldugu SORU - metni, gorseli ve siklariyla.
   *
   * Onceden yalnizca `questionText` aliniyordu; coktan secmeli bir soruda
   * bu, egitmene "ogrenci A dedi" deyip A'nin ne oldugunu gostermemek
   * demekti. Puani belirleyecek olan ekranda eksik olmamasi gereken tam da
   * bu bilgiydi. Soru bulunamiyorsa (havuzdan silinmis olabilir) null.
   */
  question?: Question | null;
  /**
   * Sorunun BU SINAVDAKI puani (`exam_questions.points`).
   *
   * Diyalog bu olcekte konusur: 25 puanlik bir sorudan en fazla 25 verilir.
   * Veritabani puani yuzde tuttugu icin cevrim kaydederken yapilir
   * (bkz. lib/score-scale.ts).
   *
   * Varsayilan 100 tesadufi degil: sorunun puani bilinmiyorsa (havuzdan
   * silinmis soru) olcek yuzdenin kendisi olur ve tum cevrimler birim islem
   * haline gelir - yani eski davranis aynen korunur.
   */
  maxPoints?: number;
  canPersist?: boolean;
}

/**
 * Eğitmenin AI on puanini onaylama / düzeltme diyalogu.
 *
 * Urunun temel iddiasi burada tamamlanir: AI yalnızca ONERIR, puanı
 * kesinlestiren egitmendir. Onaydan sonra cevap `egitmen_onayli` olur ve
 * öğrenci nihai puanı gorur.
 */
export function SubmissionReviewDialog({
  submission,
  studentName,
  question = null,
  maxPoints = 100,
  canPersist = true,
}: SubmissionReviewDialogProps) {
  const router = useRouter();

  const aiScore = submission.ai_score;
  const isTest = question?.type === "test";

  /** Diyalogun konustugu olcek. Soru puani yoksa yuzde olarak kalir. */
  const olcek = maxPoints;
  const aiPuan = aiScore === null ? null : yuzdedenPuana(aiScore, olcek);

  /**
   * Rubrik maddeleri AI'in kendi olceginde gelir (maddelerin toplami AI'in tam
   * puani). Ekranda sorunun puanina cevrilir; yoksa 25 puanlik bir sorunun
   * altinda "40 / 40" gibi sinavla ilgisi olmayan bir sayi gorunurdu.
   */
  const kriterler = submission.ai_criteria_json ?? [];
  const kriterToplam = kriterler.reduce((toplam, k) => toplam + k.max, 0);
  const kriterKatsayi = kriterToplam > 0 ? olcek / kriterToplam : 1;

  const [open, setOpen] = React.useState(false);

  /**
   * Baslangic degeri VARSA egitmenin onceki karari, yoksa AI on puani.
   *
   * Onceden hep `ai_score` ile baslatiliyordu: onaylanmis bir cevap tekrar
   * acilip kaydedildiginde egitmenin duzeltmesi sessizce AI puanina geri
   * doner, notu da silinirdi.
   */
  const [score, setScore] = React.useState<string>(() =>
    initialScore(submission, olcek),
  );
  const [note, setNote] = React.useState(submission.instructor_note ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sunucudan yeni veri gelince (router.refresh) formu tazele; diyalog acikken
  // dokunma, kullanicinin yazdigini altindan cekmis oluruz.
  React.useEffect(() => {
    if (open) return;
    setScore(initialScore(submission, olcek));
    setNote(submission.instructor_note ?? "");
    // olcek de bagimli: sorunun sinavdaki puani degisirse kutudaki deger de
    // yeni olcege gore tazelenmelidir.
  }, [open, submission, olcek]);

  const parsedScore = Number(score);
  const isScoreValid =
    score.trim() !== "" &&
    Number.isFinite(parsedScore) &&
    parsedScore >= 0 &&
    parsedScore <= olcek &&
    // Bucuklu puan yok: sinav kagidinda 1,5 diye bir puan verilmiyor.
    Number.isInteger(parsedScore);

  /** AI puanindan sapma - eğitmenin duzeltmesini görünür kilar. */
  const delta = aiPuan !== null && isScoreValid ? parsedScore - aiPuan : null;

  /** Puani bir tam puan artirir/azaltir; sinirlarin disina tasmaz. */
  function puanOynat(fark: number) {
    const suanki = Number.isFinite(parsedScore) ? parsedScore : 0;
    setScore(String(Math.min(olcek, Math.max(0, Math.round(suanki) + fark))));
  }

  async function handleApprove() {
    if (!isScoreValid) {
      setError(`Puan 0 ile ${olcek} arasında TAM sayı olmalıdır.`);
      return;
    }

    setPending(true);
    setError(null);

    const result = await approveSubmission({
      submissionId: submission.id,
      // Sutun yuzde tutuyor; egitmenin girdigi puan burada cevrilir.
      score: puandanYuzdeye(parsedScore, olcek),
      note,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error("Puan onaylanamadı", { description: result.error });
      return;
    }

    toast.success("Puan onaylandı", {
      description: `${studentName} için nihai puan ${parsedScore} olarak kaydedildi.`,
    });

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        Etiket "Puanı incele" DEGIL "Düzenle".

        Onaylamak icin bu pencereyi acmak ZORUNLU degil artik: cevap
        satirinda dogrudan bir "Onayla" dugmesi var (bkz.
        classroom-exam-review.tsx). Bu pencere yalnizca AI'in verdigi puani
        DEGISTIRMEK isteyene lazim; adi da o isi anlatmali. "Puanı incele"
        egitmene her cevap icin buraya girmesi gerektigini dusundurtuyordu.
      */}
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Düzenle
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Puanı onayla</DialogTitle>
          <DialogDescription>
            {studentName} adli öğrencinin cevabı. AI puanı bir ONERIDIR; nihai puanı
            siz belirlersiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {question ? (
            <QuestionBody
              question={question}
              topic={question.topic}
              studentAnswer={isTest ? submission.answer_text : null}
              revealAnswer
              showRubric
              className="rounded-xl border bg-muted/20 p-3"
            />
          ) : null}

          {/* Test sorusunda secim zaten sikkin uzerinde isaretli; ayrica
              "A" yazan bir kutu tekrar olurdu. */}
          {isTest ? null : (
            <StudentAnswerBlock answerText={submission.answer_text} />
          )}

          {aiScore !== null ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI on puani</span>
                <span className="ml-auto text-lg font-semibold tabular">
                  {puanGosterimi(aiPuan ?? 0)} / {olcek}
                </span>
              </div>
              <Progress value={aiScore} className="h-1.5" />
              {submission.ai_feedback ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {submission.ai_feedback}
                </p>
              ) : null}
              {kriterler.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rubrik kırılımı
                  </p>
                  {kriterler.map((criterion, index) => (
                    <div key={`${criterion.criterion}-${index}`} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-medium">{criterion.criterion}</span>
                        <span className="tabular text-muted-foreground">
                          {puanGosterimi(criterion.earned * kriterKatsayi)} /{" "}
                          {puanGosterimi(criterion.max * kriterKatsayi)}
                        </span>
                      </div>
                      <Progress
                        value={
                          criterion.max > 0
                            ? (criterion.earned / criterion.max) * 100
                            : 0
                        }
                        className="h-1"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {criterion.comment}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              Bu cevap için AI puanı yok; puanı doğrudan siz belirleyeceksiniz.
            </p>
          )}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor={`score-${submission.id}`}>
              Nihai puan (0-{olcek})
            </Label>
            {/*
              Tarayicinin kendi cevirme oklari (spin button) gizlendi: her
              tarayicida baska turlu ciziliyor ve tasarim diline hic uymuyordu.
              Yerine tasarim sistemindeki dugmeler kondu - islev ayni, gorunum
              panelin geri kalaniyla ayni dilde.
            */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => puanOynat(-1)}
                disabled={pending || parsedScore <= 0}
                aria-label="Puanı azalt"
              >
                <Minus className="h-4 w-4" />
              </Button>

              <Input
                id={`score-${submission.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={olcek}
                step={1}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                className="tabular text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => puanOynat(1)}
                disabled={pending || parsedScore >= olcek}
                aria-label="Puanı artır"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {delta !== null && delta !== 0 ? (
              <p className="text-xs text-muted-foreground">
                AI puanından {delta > 0 ? "+" : ""}
                {puanGosterimi(delta)} puan sapma.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`note-${submission.id}`}>Eğitmen notu (opsiyonel)</Label>
            <Textarea
              id={`note-${submission.id}`}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Öğrenciye iletilecek kısa açıklama..."
              className="resize-y"
            />
          </div>

          {canPersist ? null : (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tanıtım modu: ekranı inceleyebilirsiniz, puan kaydedilmez.
            </p>
          )}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            className="gap-2"
            disabled={pending || !isScoreValid}
            onClick={() => void handleApprove()}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Onaylaniyor...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Puanı onayla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Diyalogun acilis puani: egitmen kararı > AI on puani > bos. */
/**
 * Formun acilis degeri - SORU PUANI olceginde.
 *
 * Sutunlar yuzde tuttugu icin okunan deger cevrilir; `puanGosterimi` ile de
 * gereksiz ondalik kirpilir, yoksa 28% x 25 = 6.999999 kutuya oyle duserdi.
 */
function initialScore(submission: Submission, olcek: number): string {
  const yuzde =
    submission.instructor_approved_score !== null
      ? submission.instructor_approved_score
      : submission.ai_score;

  // AI yuzdesi tam puana denk gelmeyebilir (%83,33 x 25 = 20,83); egitmene
  // giremeyecegi bir baslangic degeri gostermemek icin yuvarlanir.
  return yuzde === null ? "" : String(Math.round(yuzdedenPuana(yuzde, olcek)));
}
