"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { createExam } from "@/app/actions/exams";
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
import { Textarea } from "@/components/ui/textarea";

export interface ExamCreateDialogProps {
  /**
   * Supabase yapilandirilmis mi? Demo modunda form yine acilir ve incelenebilir;
   * yalnizca kaydetme adimi hata dondurur. Devre disi buton yerine bu yol
   * secildi: boylece ekranin ne yaptigi gorulebiliyor.
   */
  canPersist?: boolean;
}

/**
 * Yeni sinav olusturma diyalogu.
 * Sinav taslak olarak dogar; sorular eklendikten sonra yayina alinir.
 */
export function ExamCreateDialog({ canPersist = true }: ExamCreateDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startsAt, setStartsAt] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");
  const [pending, setPending] = React.useState(false);

  /** `datetime-local` degeri yerel saattir; ISO'ya cevrilerek saklanir. */
  function toIso(value: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const result = await createExam({
      title,
      description,
      ...(toIso(startsAt) ? { startsAt: toIso(startsAt) } : {}),
      ...(toIso(endsAt) ? { endsAt: toIso(endsAt) } : {}),
    });

    setPending(false);

    if (!result.ok) {
      toast.error("Sinav olusturulamadi", { description: result.error });
      return;
    }

    toast.success("Sinav olusturuldu", {
      description: "Simdi havuzdan soru ekleyip yayina alabilirsiniz.",
    });

    setOpen(false);
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    router.push(`/dashboard/egitmen/sinavlar/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni sinav
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni sinav olustur</DialogTitle>
          <DialogDescription>
            Once sinavin adini belirleyin. &ldquo;Olustur&rdquo;a bastiginizda
            soru secme ekrani acilir; havuzdan soru ekleyip yayina alarak
            ogrencilere acabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exam-title">Sinav basligi</Label>
            <Input
              id="exam-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Biyoloji 1. Donem Ara Sinavi"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-description">Aciklama</Label>
            <Textarea
              id="exam-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Hangi konulari kapsadigini kisaca yazin."
              className="resize-y"
            />
          </div>

          {/*
            Tarih alanlari ALT ALTA duruyor: `datetime-local` denetiminin kendi
            asgari genisligi var (tarih + saat + takvim ikonu) ve diyalog
            genisliginde iki kolona sigmiyor - ikon kutunun disina tasiyordu.
          */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exam-starts" className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Baslangic
              </Label>
              <Input
                id="exam-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-ends" className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Bitis
              </Label>
              <Input
                id="exam-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Tarihler opsiyoneldir; bos birakirsaniz sinav yayina alindigi anda erisilir.
          </p>

          {canPersist ? null : (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Demo modu: formu inceleyebilirsiniz ama Supabase baglantisi olmadan
              sinav kaydedilemez.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" className="gap-2" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Olusturuluyor...
                </>
              ) : (
                "Olustur"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
