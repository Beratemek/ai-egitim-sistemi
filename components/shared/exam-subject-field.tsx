"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Check, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { setExamSubject } from "@/app/actions/exams";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sinavin dersi.
 *
 * Ders yetkisinin dayanagi budur: sinavi yalnizca bu derse yetkili egitmenler
 * gorur. Olusturma sirasinda atlanmis olabilecegi icin sonradan da
 * duzeltilebilmeli - aksi halde dersi bos birakilan bir sinav KALICI olarak
 * tum egitmenlere acik kalirdi.
 */

export interface ExamSubjectFieldProps {
  examId: string;
  /** Sinavin su anki dersi; atanmamissa null. */
  subject: string | null;
  /** Secilebilir ders adlari; soru havuzundan turetilir. */
  subjectOptions?: readonly string[];
  canPersist?: boolean;
}

export function ExamSubjectField({
  examId,
  subject,
  subjectOptions = [],
  canPersist = true,
}: ExamSubjectFieldProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(subject ?? "");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setDraft(subject ?? "");
  }, [subject]);

  const dirty = draft.trim() !== (subject ?? "");

  async function save() {
    if (!canPersist) {
      toast.error("Demo modunda kayıt yapılamaz");
      return;
    }

    setPending(true);
    try {
      const result = await setExamSubject(examId, draft);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.subject
          ? `Ders: ${result.data.subject}`
          : "Ders bilgisi kaldırıldı",
      );
      router.refresh();
    } catch (caught) {
      toast.error("Ders kaydedilemedi", {
        description:
          caught instanceof Error ? caught.message : "Lütfen tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="space-y-2">
          <Label htmlFor="exam-subject-edit" className="flex items-center gap-1.5">
            <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
            Sınavın dersi
          </Label>

          <div className="flex max-w-md gap-1.5">
            <Input
              id="exam-subject-edit"
              list="exam-subject-edit-options"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && dirty) void save();
              }}
              placeholder="Biyoloji"
              autoComplete="off"
              disabled={pending}
            />
            <datalist id="exam-subject-edit-options">
              {subjectOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <Button
              size="icon"
              variant={dirty ? "default" : "ghost"}
              className="shrink-0"
              disabled={!dirty || pending}
              onClick={() => void save()}
              aria-label="Dersi kaydet"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {subject ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bu sınavı yalnızca{" "}
            <span className="font-medium text-foreground">{subject}</span>{" "}
            dersine yetkili eğitmenler ve sınavın sahibi görür.
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-600 dark:text-amber-500">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Ders atanmadığı için bu sınav <strong>tüm eğitmenlere</strong> açık.
            Bir ders yazarsanız yalnızca o derse yetkili eğitmenler görür.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
