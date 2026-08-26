"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { deleteUser, getUserDeletionImpact } from "@/app/actions/admin";
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
 * Kullaniciyi kalici olarak silme dugmesi (yalnizca sistem yoneticisi).
 *
 * Onay ekrani SOMUT konusur: "bu kisiyi silersen sunlar gider". Sayilar
 * diyalog acilinca sunucudan cekilir - liste her yuklendiginde herkes icin
 * hesaplamak, nadiren kullanilan bir islem icin gereksiz maliyetti.
 *
 * En tehlikeli hal EGITMEN silmek: sinavlari da gider ve onlara bagli BASKA
 * ogrencilerin teslimleri birlikte kaybolur. Bu yuzden sinav sayisi ayri bir
 * uyari satiri olarak cikar; genel "geri alinamaz" cumlesinin icinde
 * kaybolmasin.
 */
export interface UserDeleteButtonProps {
  userId: string;
  /** Onay ekraninda gosterilecek ad; bos ise e-postaya dusulur. */
  displayName: string;
  className?: string;
}

interface Impact {
  examCount: number;
  submissionCount: number;
  isSelf: boolean;
}

export function UserDeleteButton({
  userId,
  displayName,
  className,
}: UserDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [impact, setImpact] = React.useState<Impact | null>(null);
  const [impactError, setImpactError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  /** Diyalog acilinca etkiyi cek; kapaninca durumu sifirla. */
  React.useEffect(() => {
    if (!open) {
      setImpact(null);
      setImpactError(null);
      return;
    }

    let iptal = false;

    void (async () => {
      /*
        try/catch SART: aksiyon firlatirsa (ag hatasi, eksik servis anahtari)
        yakalayan kimse olmayinca `impact` sonsuza kadar null kalir ve silme
        dugmesi sebebi ekranda yazmadan pasif dururdu.
      */
      try {
        const result = await getUserDeletionImpact(userId);
        if (iptal) return;

        if (result.ok) setImpact(result.data);
        else setImpactError(result.error);
      } catch (caught) {
        if (iptal) return;
        setImpactError(
          caught instanceof Error ? caught.message : "Etki hesaplanamadı.",
        );
      }
    })();

    return () => {
      iptal = true;
    };
  }, [open, userId]);

  async function handleDelete() {
    setPending(true);
    const result = await deleteUser(userId);
    setPending(false);

    if (!result.ok) {
      toast.error("Kullanıcı silinemedi", { description: result.error });
      return;
    }

    setOpen(false);
    toast.success("Kullanıcı silindi", {
      description: `${displayName} ve hesabına bağlı veriler kaldırıldı.`,
    });
    router.refresh();
  }

  /*
    Silmeyi ENGELLEYEN tek sey kendi hesabin.

    Etki sayilari bir bilgilendirmedir, bir kapi degil: hesaplanamadiginda
    (ag hatasi, eksik anahtar) silmenin de calismamasi icin bir sebep yok.
    Onceden sayilar gelmeden dugme pasifti ve hesap patlarsa kilitli
    kaliyordu - "silinemiyor" gorunumunun asil sebebi buydu.
  */
  const yukleniyor = impact === null && impactError === null;
  const silinebilir = !impact?.isSelf && !yukleniyor && !pending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-destructive",
            className,
          )}
          aria-label={`${displayName} kullanıcısını sil`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" />
            Kullanıcıyı kalıcı olarak sil
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">{displayName}</span>{" "}
                hesabı ve giriş bilgileri kalıcı olarak silinecek.{" "}
                <span className="font-medium text-foreground">
                  Bu işlem geri alınamaz.
                </span>
              </p>

              {impactError ? (
                <p className="text-destructive">{impactError}</p>
              ) : impact === null ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Nelerin silineceği hesaplanıyor…
                </p>
              ) : impact.isSelf ? (
                <p className="text-destructive">
                  Kendi hesabınızı silemezsiniz; bunu başka bir sistem yöneticisi
                  yapmalı.
                </p>
              ) : (
                <>
                  <p>
                    Bu kişinin{" "}
                    <span className="font-medium text-foreground">
                      {impact.submissionCount} cevabı
                    </span>
                    , sınav denemeleri, atamaları ve çalışma planı silinir.
                    Yazdığı sorular havuzda kalır; yalnızca yazarı bilinmez olur.
                  </p>

                  {impact.examCount > 0 ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                      Bu kişi{" "}
                      <span className="font-semibold">
                        {impact.examCount} sınavın
                      </span>{" "}
                      sahibi. Hesap silinince o sınavlar da silinir ve{" "}
                      <span className="font-semibold">
                        sınavlara giren diğer öğrencilerin teslimleri ile
                        sonuçları
                      </span>{" "}
                      birlikte kaybolur.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Vazgeç
          </Button>

          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={!silinebilir}
            className="gap-2"
          >
            {pending ? (
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
