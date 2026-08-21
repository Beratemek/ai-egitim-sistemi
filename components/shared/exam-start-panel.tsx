"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { startExam } from "@/app/actions/submissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface ExamStartPanelProps {
  examId: string;
  questionCount: number;
  totalPoints: number;
  endsAt: string | null;
}

/** Sorulari gostermeden once sinav kurallarini ve baslatma onayini sunar. */
export function ExamStartPanel({
  examId,
  questionCount,
  totalPoints,
  endsAt,
}: ExamStartPanelProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleStart() {
    setPending(true);
    setError(null);
    const result = await startExam(examId);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      toast.error("Sinav baslatilamadi", { description: result.error });
      return;
    }

    toast.success("Sinav baslatildi");
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-2xl border-primary/20">
      <CardHeader>
        <CardTitle>Sinava baslamadan once</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Soru sayisi" value={String(questionCount)} />
          <Info label="Toplam puan" value={String(totalPoints)} />
          <Info
            label="Son teslim"
            value={endsAt ? formatDateTime(endsAt) : "Sure siniri yok"}
          />
        </div>

        <ul className="space-y-3 text-sm text-muted-foreground">
          <Rule>Cevaplariniz her soruda ayri ayri kaydedilir.</Rule>
          <Rule>Sinavi teslim edene kadar kaydedilen cevaplari degistirebilirsiniz.</Rule>
          <Rule>Sure doldugunda kaydedilen cevaplar otomatik teslim edilir.</Rule>
          <Rule>Nihai sonucunuz egitmen onayindan sonra aciklanir.</Rule>
        </ul>

        {endsAt ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            Sinavi baslatmaniz son teslim zamanini degistirmez.
          </p>
        ) : null}

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button onClick={handleStart} disabled={pending || questionCount === 0} className="w-full gap-2">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {pending ? "Sinav baslatiliyor..." : "Sinava basla"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
