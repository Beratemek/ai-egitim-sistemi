"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { approveSubmission } from "@/app/actions/submissions";
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
import type { Submission } from "@/lib/types";

export interface SubmissionReviewDialogProps {
  submission: Submission;
  /** Ogrenci adi - baslikta gosterilir. */
  studentName: string;
  /** Cevabin ait oldugu soru metni; elde yoksa gecilebilir. */
  questionText?: string;
  canPersist?: boolean;
}

/**
 * Egitmenin AI on puanini onaylama / duzeltme diyalogu.
 *
 * Urunun temel iddiasi burada tamamlanir: AI yalnizca ONERIR, puani
 * kesinlestiren egitmendir. Onaydan sonra cevap `egitmen_onayli` olur ve
 * ogrenci nihai puani gorur.
 */
export function SubmissionReviewDialog({
  submission,
  studentName,
  questionText,
  canPersist = true,
}: SubmissionReviewDialogProps) {
  const router = useRouter();

  const aiScore = submission.ai_score;

  const [open, setOpen] = React.useState(false);
  const [score, setScore] = React.useState<string>(
    aiScore === null ? "" : String(aiScore),
  );
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsedScore = Number(score);
  const isScoreValid =
    score.trim() !== "" &&
    Number.isFinite(parsedScore) &&
    parsedScore >= 0 &&
    parsedScore <= 100;

  /** AI puanindan sapma - egitmenin duzeltmesini gorunur kilar. */
  const delta = aiScore !== null && isScoreValid ? parsedScore - aiScore : null;

  async function handleApprove() {
    if (!isScoreValid) {
      setError("Puan 0 ile 100 arasinda bir sayi olmalidir.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await approveSubmission({
      submissionId: submission.id,
      score: parsedScore,
      ...(note.trim() ? { note } : {}),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error("Puan onaylanamadi", { description: result.error });
      return;
    }

    toast.success("Puan onaylandi", {
      description: `${studentName} icin nihai puan ${parsedScore} olarak kaydedildi.`,
    });

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          Puani incele
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Puani onayla</DialogTitle>
          <DialogDescription>
            {studentName} adli ogrencinin cevabi. AI puani bir ONERIDIR; nihai puani
            siz belirlersiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {questionText ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Soru
              </p>
              <p className="text-sm leading-relaxed">{questionText}</p>
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ogrencinin cevabi
            </p>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
              {submission.answer_text}
            </p>
          </div>

          {aiScore !== null ? (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI on puani</span>
                <span className="ml-auto text-lg font-semibold tabular">
                  {aiScore} / 100
                </span>
              </div>
              <Progress value={aiScore} className="h-1.5" />
              {submission.ai_feedback ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {submission.ai_feedback}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              Bu cevap icin AI puani yok; puani dogrudan siz belirleyeceksiniz.
            </p>
          )}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor={`score-${submission.id}`}>Nihai puan (0-100)</Label>
            <Input
              id={`score-${submission.id}`}
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={score}
              onChange={(event) => setScore(event.target.value)}
              className="tabular"
            />
            {delta !== null && delta !== 0 ? (
              <p className="text-xs text-muted-foreground">
                AI puanindan {delta > 0 ? "+" : ""}
                {Math.round(delta * 100) / 100} puan sapma.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`note-${submission.id}`}>Egitmen notu (opsiyonel)</Label>
            <Textarea
              id={`note-${submission.id}`}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ogrenciye iletilecek kisa aciklama..."
              className="resize-y"
            />
          </div>

          {canPersist ? null : (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Demo modu: onay ekranini inceleyebilirsiniz ama puan kaydedilemez.
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
                Puani onayla
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
