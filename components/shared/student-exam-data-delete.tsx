"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { deleteStudentExamData } from "@/app/actions/exams";
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

/**
 * Egitim yoneticisi: TEK ogrencinin TEK sinavdaki verisini siler.
 *
 * Sinav silme ile karistirilmamali - sinavin kendisi ve diger ogrencilerin
 * cevaplari yerinde kalir. Yanlis hesaptan girilmis, tekrarlanmis ya da
 * gecersiz sayilan bir deneme icin var.
 *
 * Cevaplarla birlikte DENEME kaydi da gider: ogrenci o sinava hic girmemis
 * sayilir. Yalnizca cevaplar silinseydi ogrenci "girdi ama bos" gorunur ve
 * sinif ortalamasini sifir puanla asagi cekerdi.
 */
export interface StudentExamDataDeleteProps {
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
}

export function StudentExamDataDelete({
  examId,
  examTitle,
  studentId,
  studentName,
}: StudentExamDataDeleteProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    const result = await deleteStudentExamData(examId, studentId);
    setPending(false);

    if (!result.ok) {
      toast.error("Veri silinemedi", { description: result.error });
      return;
    }

    setOpen(false);
    toast.success("Öğrencinin sınav verisi silindi", {
      description: `${studentName} bu sınava hiç girmemiş sayılır.`,
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`${studentName} öğrencisinin ${examTitle} verisini sil`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            Öğrencinin sınav verisini sil
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">{studentName}</span>{" "}
                öğrencisinin{" "}
                <span className="font-medium text-foreground">{examTitle}</span>{" "}
                sınavındaki cevapları ve deneme kaydı silinecek.
              </p>
              <p>
                Sınavın kendisi ve diğer öğrencilerin verileri etkilenmez.
                Öğrenci bu sınava hiç girmemiş sayılır; sınıf istatistiklerinden
                de düşer.{" "}
                <span className="font-medium text-foreground">
                  Bu işlem geri alınamaz.
                </span>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={pending}
            className="gap-2"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Veriyi sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
