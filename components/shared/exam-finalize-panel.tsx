"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { finalizeExam } from "@/app/actions/submissions";
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

export interface ExamFinalizePanelProps {
  examId: string;
  answeredCount: number;
  questionCount: number;
}

/** Tüm cevaplar kaydedildiginde sınavı geri donulemez sekilde teslim eder. */
export function ExamFinalizePanel({
  examId,
  answeredCount,
  questionCount,
}: ExamFinalizePanelProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const remaining = Math.max(0, questionCount - answeredCount);
  const ready = questionCount > 0 && remaining === 0;

  async function handleFinalize() {
    setPending(true);
    setError(null);
    const response = await finalizeExam(examId);
    setPending(false);

    if (!response.ok) {
      setError(response.error);
      toast.error("Sınav teslim edilemedi", { description: response.error });
      return;
    }

    setOpen(false);
    toast.success("Sınavınız teslim edildi", {
      description: "Sonuçlar eğitmen onayından sonra açıklanacak.",
    });
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
        Sinavi bitirebilmek icin kalan <strong className="text-foreground">{remaining}</strong>{" "}
        sorunun cevabini kaydedin.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Tum cevaplariniz kaydedildi</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Cevaplarınızı kontrol edin. Teslim ettikten sonra degisiklik yapamazsiniz.
          </p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogTrigger asChild>
          <Button className="shrink-0 gap-2">
            <Send className="h-4 w-4" />
            Sınavı bitir
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sınavı teslim etmek istiyor musunuz?</DialogTitle>
            <DialogDescription>
              {questionCount} cevabınız AI on degerlendirmesine gonderilecek. Bu
              islemden sonra cevaplarınızı degistiremezsiniz.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cevaplara don
            </Button>
            <Button onClick={handleFinalize} disabled={pending} className="gap-2">
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Değerlendirme başlatılıyor...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Onayla ve teslim et
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
