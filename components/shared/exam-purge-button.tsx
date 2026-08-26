"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { deleteExamPermanently, unarchiveExam } from "@/app/actions/exams";
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
import { cn } from "@/lib/utils";

/**
 * Sinav kontrolu sayfasindaki KALICI silme dugmesi.
 *
 * Sinav listesindeki "Sil" ile ayni sey DEGIL: orada cozulmus bir sinav
 * arsivlenir, veri korunur. Burasi arsivin sonu - egitmen artik o sinavin
 * cevaplarina da ihtiyaci olmadigina karar verdiginde kullanir ve islem geri
 * alinamaz.
 *
 * Arsivlenmis bir sinavda ayrica "Geri al" sunulur: yanlislikla arsivlenen
 * sinavi listeye dondurmenin tek yolu bu, yoksa egitmen sinavi bir daha
 * kendi listesinde goremezdi.
 */
export interface ExamPurgeButtonProps {
  examId: string;
  examTitle: string;
  /** Sinav arsivlenmis mi? Arsivdeyse "Geri al" da sunulur. */
  archived: boolean;
  /** Silinecek cevap sayisi - uyarinin somut olmasi icin. */
  submittedCount: number;
  className?: string;
}

export function ExamPurgeButton({
  examId,
  examTitle,
  archived,
  submittedCount,
  className,
}: ExamPurgeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<"sil" | "gerial" | null>(null);

  async function handlePurge() {
    setPending("sil");
    const result = await deleteExamPermanently(examId);
    setPending(null);

    if (!result.ok) {
      toast.error("Sınav silinemedi", { description: result.error });
      return;
    }

    setOpen(false);
    toast.success("Sınav kalıcı olarak silindi", {
      description: "Sınav ve tüm cevapları kaldırıldı.",
    });
    router.refresh();
  }

  async function handleUnarchive() {
    setPending("gerial");
    const result = await unarchiveExam(examId);
    setPending(null);

    if (!result.ok) {
      toast.error("Sınav geri alınamadı", { description: result.error });
      return;
    }

    setOpen(false);
    toast.success("Sınav arşivden çıkarıldı", {
      description: "Sınavlar listenizde yeniden görünüyor.",
    });
    router.refresh();
  }

  const busy = pending !== null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // relative z-10: kart bastan sona bir baglanti katmaniyla ortulu,
          // dugme onun ustunde kalmali.
          className={cn(
            "relative z-10 h-8 w-8 text-muted-foreground hover:text-destructive",
            className,
          )}
          aria-label={`${examTitle} sınavını kalıcı olarak sil`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            Sınavı kalıcı olarak sil
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">{examTitle}</span>{" "}
                ve ona ait{" "}
                <span className="font-medium text-foreground">
                  {submittedCount} teslim
                </span>{" "}
                kalıcı olarak silinecek.
              </p>
              <p>
                Cevaplar bu sayfadan, istatistikler eğitim yöneticisi panelinden,
                sonuçlar öğrencinin kendi ekranından kaybolur.{" "}
                <span className="font-medium text-foreground">
                  Bu işlem geri alınamaz.
                </span>
              </p>
              {archived ? (
                <p>
                  Sınav şu an arşivde. Yalnızca listenizi toparlamak
                  istiyorsanız olduğu yerde bırakabilir ya da geri alabilirsiniz.
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            {archived ? (
              <Button
                variant="outline"
                onClick={() => void handleUnarchive()}
                disabled={busy}
                className="gap-2"
              >
                {pending === "gerial" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Arşivden çıkar
              </Button>
            ) : null}
          </div>

          <Button
            variant="destructive"
            onClick={() => void handlePurge()}
            disabled={busy}
            className="gap-2"
          >
            {pending === "sil" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Kalıcı olarak sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
