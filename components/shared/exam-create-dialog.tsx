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
   * Supabase yapilandirilmis mi? Demo modunda form yine açılır ve incelenebilir;
   * yalnızca kaydetme adimi hata döndürür. Devre disi buton yerine bu yol
   * secildi: boylece ekranin ne yaptigi gorulebiliyor.
   */
  canPersist?: boolean;
  /**
   * Secilebilir ders adlari; soru havuzundan turetilir.
   *
   * Ders yetkisinin dayanagi budur: sinava ders atanmazsa TUM egitmenler
   * gorur, atanirsa yalnizca o derse yetkili olanlar.
   */
  subjectOptions?: readonly string[];
}

/**
 * Yeni sınav oluşturma diyalogu.
 * Sınav taslak olarak dogar; sorular eklendikten sonra yayına alınır.
 */
export function ExamCreateDialog({
  canPersist = true,
  subjectOptions = [],
}: ExamCreateDialogProps) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subject, setSubject] = React.useState("");
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
      subject,
      ...(toIso(startsAt) ? { startsAt: toIso(startsAt) } : {}),
      ...(toIso(endsAt) ? { endsAt: toIso(endsAt) } : {}),
    });

    setPending(false);

    if (!result.ok) {
      toast.error("Sınav oluşturulamadı", { description: result.error });
      return;
    }

    toast.success("Sınav oluşturuldu", {
      description: "Şimdi havuzdan soru ekleyip yayına alabilirsiniz.",
    });

    setOpen(false);
    setTitle("");
    setDescription("");
    setSubject("");
    setStartsAt("");
    setEndsAt("");
    router.push(`/dashboard/egitmen/sinavlar/${result.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni sınav
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni sınav oluştur</DialogTitle>
          <DialogDescription>
            Önce sınavın adini belirleyin. &ldquo;Oluştur&rdquo;a bastiginizda
            soru seçme ekrani açılır; havuzdan soru ekleyip yayına alarak
            ogrencilere acabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="exam-title">Sınav başlığı</Label>
            <Input
              id="exam-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Biyoloji 1. Dönem Ara Sınavı"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-description">Açıklama</Label>
            <Textarea
              id="exam-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Hangi konuları kapsadığını kısaca yazın."
              className="resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-subject">Ders</Label>
            <Input
              id="exam-subject"
              list="exam-subject-options"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Biyoloji"
              autoComplete="off"
            />
            <datalist id="exam-subject-options">
              {subjectOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Sınavı yalnızca bu derse yetkili eğitmenler görür. Boş
              bırakırsanız tüm eğitmenlere açık kalır.
            </p>
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
                Başlangıç
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
                Bitiş
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
            Tarihler opsiyoneldir; boş birakirsaniz sınav yayına alindigi anda erisilir.
          </p>

          {canPersist ? null : (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tanıtım modu: formu inceleyebilirsiniz, kayıt yapılmaz.
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
