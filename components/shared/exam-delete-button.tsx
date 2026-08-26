"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteExam } from "@/app/actions/exams";
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
 * Sinavi listeden kaldirma dugmesi.
 *
 * "Sil" iki farkli sey yapar ve HANGISI oldugunu kullanici onaylamadan once
 * bilir:
 *
 *   - Sinavi hic kimse cozmemisse KALICI silinir; korunacak veri yoktur.
 *   - Cozulmusse ARSIVLENIR: egitmenin listesinden cikar ama kontrol
 *     sayfasinda, yonetici raporlarinda ve ogrencinin sonuc ekraninda kalir.
 *
 * Kararin son sozu sunucuda: `deleteExam` cevaplarin yaninda DENEME kayitlarina
 * da bakar (cevap yazmadan sinava baslamis bir ogrenci de veridir). Bu yuzden
 * bildirim, tahmini degil sunucunun dondurdugu sonucu yazar.
 */
export interface ExamDeleteButtonProps {
  examId: string;
  examTitle: string;
  /** Bilinen cevap sayisi - yalnizca onay metnini secmek icin. */
  submissionCount: number;
  className?: string;
}

export function ExamDeleteButton({
  examId,
  examTitle,
  submissionCount,
  className,
}: ExamDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const cozulmus = submissionCount > 0;

  async function handleDelete() {
    setPending(true);
    const result = await deleteExam(examId);
    setPending(false);

    if (!result.ok) {
      toast.error("Sınav kaldırılamadı", { description: result.error });
      return;
    }

    setOpen(false);

    if (result.data.outcome === "arsivlendi") {
      toast.success("Sınav arşivlendi", {
        description:
          "Listenizden kaldırıldı. Cevaplar sınav kontrolü sayfasında ve yönetici raporlarında duruyor.",
      });
    } else {
      toast.success("Sınav silindi", {
        description: "Bu sınavı kimse çözmemişti; kalıcı olarak kaldırıldı.",
      });
    }

    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // z-10 + relative: kartin tamami bir baglanti katmaniyla ortulu,
          // dugme onun USTUNDE kalmali yoksa tiklama sinav detayina gider.
          className={cn(
            "relative z-10 h-8 w-8 text-muted-foreground hover:text-destructive",
            className,
          )}
          aria-label={`${examTitle} sınavını kaldır`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {cozulmus ? "Sınavı arşivle" : "Sınavı sil"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">{examTitle}</span>{" "}
                {cozulmus
                  ? "öğrenciler tarafından çözülmüş."
                  : "henüz kimse tarafından çözülmemiş."}
              </p>
              {cozulmus ? (
                <p>
                  Sınav listenizden kaldırılacak ama{" "}
                  <span className="font-medium text-foreground">veriler silinmeyecek</span>:
                  cevaplar sınav kontrolü sayfasında, istatistikler eğitim
                  yöneticisi panelinde durmaya devam edecek. Öğrenci de kendi
                  sonucunu görmeyi sürdürür.
                </p>
              ) : (
                <p>
                  Korunacak bir cevap yok, bu yüzden sınav{" "}
                  <span className="font-medium text-foreground">kalıcı olarak</span>{" "}
                  silinecek. Bu işlem geri alınamaz.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Vazgeç
          </Button>
          <Button
            variant={cozulmus ? "default" : "destructive"}
            onClick={() => void handleDelete()}
            disabled={pending}
            className="gap-2"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {cozulmus ? "Arşivle" : "Kalıcı olarak sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
