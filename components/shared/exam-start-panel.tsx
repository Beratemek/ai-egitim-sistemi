"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { startExam } from "@/app/actions/submissions";
import { ProctoringGate } from "@/components/shared/proctoring-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface ExamStartPanelProps {
  examId: string;
  questionCount: number;
  totalPoints: number;
  endsAt: string | null;
  proctored: boolean;
}

/** Soruları göstermeden önce sınav kurallarını ve başlatma onayını sunar. */
export function ExamStartPanel({
  examId,
  questionCount,
  totalPoints,
  endsAt,
  proctored,
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
      toast.error("Sınav başlatılamadı", { description: result.error });
      return;
    }

    toast.success("Sınav başlatıldı");
    // Sınav kendi tam ekran sayfasında çözülüyor; panel kabuğunun dışında.
    router.push(`/sinav/${examId}`);
  }

  return (
    <Card className="mx-auto max-w-3xl overflow-hidden border-primary/25">
      <CardHeader className="border-b bg-primary/[0.04]">
        <CardTitle>Sınava hazır mısın?</CardTitle>
        <CardDescription>
          Bilgileri kontrol et; hazırsan sınavını güvenle başlat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Soru sayısı" value={String(questionCount)} />
          <Info label="Toplam puan" value={String(totalPoints)} />
          <Info
            label="Son teslim"
            value={endsAt ? formatDateTime(endsAt) : "Süre sınırı yok"}
          />
        </div>

        <ul className="space-y-3 text-sm text-muted-foreground">
          <Rule>Cevapların her soruda otomatik kaydedilir.</Rule>
          <Rule>Sınavı bitirene kadar kaydettiğin cevapları değiştirebilirsin.</Rule>
          <Rule>Süre dolduğunda kayıtlı cevapların otomatik teslim edilir.</Rule>
          <Rule>Sonucun, eğitmen onayından sonra açıklanır.</Rule>
        </ul>

        {endsAt ? (
          <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
            Sınavı başlatmanız son teslim zamanını değiştirmez.
          </p>
        ) : null}

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {proctored ? (
          <ProctoringGate examId={examId} mode="preflight">
            <StartButton
              pending={pending}
              disabled={questionCount === 0}
              onStart={handleStart}
              readyLabel="Cihazlar hazır — sınavı başlat"
            />
          </ProctoringGate>
        ) : (
          <StartButton
            pending={pending}
            disabled={questionCount === 0}
            onStart={handleStart}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StartButton({
  pending,
  disabled,
  onStart,
  readyLabel = "Sınavı başlat",
}: {
  pending: boolean;
  disabled: boolean;
  onStart: () => void;
  readyLabel?: string;
}) {
  return (
    <Button
      type="button"
      onClick={onStart}
      disabled={pending || disabled}
      className="w-full gap-2"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {pending ? "Sınav başlatılıyor..." : readyLabel}
    </Button>
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
