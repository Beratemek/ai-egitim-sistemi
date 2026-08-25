"use client";

import * as React from "react";
import { LockKeyhole, MessageSquareText, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitCourseExperienceFeedback } from "@/app/actions/course-feedback";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CourseExperienceFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CourseFeedbackDialogProps {
  examId: string;
  subject: string | null;
  initialFeedback: CourseExperienceFeedback | null;
}

type Ratings = {
  clarity: number;
  pace: number;
  materials: number;
  assessmentFairness: number;
};

const RATING_FIELDS: Array<{
  key: keyof Ratings;
  label: string;
  description: string;
}> = [
  {
    key: "clarity",
    label: "Anlatımın anlaşılabilirliği",
    description: "Konu ve açıklamaları takip edebildim.",
  },
  {
    key: "pace",
    label: "Dersin hızı",
    description: "Dersin ilerleme hızı öğrenmem için uygundu.",
  },
  {
    key: "materials",
    label: "Materyallerin faydası",
    description: "Kaynaklar ve örnekler öğrenmemi destekledi.",
  },
  {
    key: "assessmentFairness",
    label: "Ölçme ve değerlendirmenin adaleti",
    description: "Sorular işlenen içerikle ve kazanımlarla uyumluydu.",
  },
];

export function CourseFeedbackDialog({
  examId,
  subject,
  initialFeedback,
}: CourseFeedbackDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [ratings, setRatings] = React.useState<Ratings>({
    clarity: initialFeedback?.clarity_rating ?? 0,
    pace: initialFeedback?.pace_rating ?? 0,
    materials: initialFeedback?.materials_rating ?? 0,
    assessmentFairness:
      initialFeedback?.assessment_fairness_rating ?? 0,
  });
  const [helpful, setHelpful] = React.useState(
    initialFeedback?.helpful_text ?? "",
  );
  const [improvement, setImprovement] = React.useState(
    initialFeedback?.improvement_text ?? "",
  );

  const complete = Object.values(ratings).every((rating) => rating > 0);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete) {
      toast.error("Lütfen dört başlığın tamamını puanlayın");
      return;
    }

    startTransition(async () => {
      const result = await submitCourseExperienceFeedback({
        examId,
        ...ratings,
        helpful,
        improvement,
      });

      if (!result.ok) {
        toast.error("Değerlendirme gönderilemedi", {
          description: result.error,
        });
        return;
      }

      toast.success(
        initialFeedback
          ? "Anonim değerlendirmeniz güncellendi"
          : "Anonim değerlendirmeniz gönderildi",
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant={initialFeedback ? "outline" : "default"} size="sm">
          <MessageSquareText className="h-4 w-4" />
          {initialFeedback
            ? "Değerlendirmeni düzenle"
            : "Ders deneyimini değerlendir"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Ders deneyimini değerlendir
          </DialogTitle>
          <DialogDescription>
            {subject || "Bu ders"} hakkındaki deneyiminizi paylaşmanız isteğe
            bağlıdır. Yanıtlarınız eğitmene yalnızca toplu ve anonim olarak
            gösterilir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="leading-relaxed text-muted-foreground">
            Adınız ve hesabınız eğitmenle paylaşılmaz. Yazılı yanıtlara ad,
            telefon veya sizi tanımlayabilecek kişisel bilgi eklemeyin.
          </p>
        </div>

        <form className="space-y-5" onSubmit={submit}>
          <div className="divide-y rounded-xl border">
            {RATING_FIELDS.map((field) => (
              <div
                key={field.key}
                className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {field.description}
                  </p>
                </div>
                <div
                  className="flex gap-1"
                  role="radiogroup"
                  aria-label={field.label}
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const selected = ratings[field.key] >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={ratings[field.key] === value}
                        aria-label={`${value} puan`}
                        onClick={() =>
                          setRatings((current) => ({
                            ...current,
                            [field.key]: value,
                          }))
                        }
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-amber-400/70 bg-amber-400/15 text-amber-600"
                            : "bg-background text-muted-foreground hover:border-amber-400/50 hover:text-amber-600",
                        )}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            selected && "fill-current",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`feedback-helpful-${examId}`}>
              Bu derste en faydalı bulduğunuz şey neydi?
            </Label>
            <Textarea
              id={`feedback-helpful-${examId}`}
              value={helpful}
              onChange={(event) => setHelpful(event.target.value)}
              maxLength={1500}
              placeholder="İsterseniz kısa bir açıklama yazabilirsiniz."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`feedback-improvement-${examId}`}>
              Nelerin geliştirilmesini istersiniz?
            </Label>
            <Textarea
              id={`feedback-improvement-${examId}`}
              value={improvement}
              onChange={(event) => setImprovement(event.target.value)}
              maxLength={1500}
              placeholder="İsterseniz geliştirme önerinizi paylaşabilirsiniz."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending || !complete}>
              {pending
                ? "Gönderiliyor..."
                : initialFeedback
                  ? "Değerlendirmeyi güncelle"
                  : "Anonim gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
