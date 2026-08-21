"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { finalizeExam } from "@/app/actions/submissions";
import { formatRemaining } from "@/lib/exam-time";
import { cn } from "@/lib/utils";

interface ExamCountdownProps {
  examId: string;
  endsAt: string;
  autoSubmit: boolean;
}

/** Sunucu son tarihine gore sayar; sifirda kayitli cevaplari otomatik teslim eder. */
export function ExamCountdown({ examId, endsAt, autoSubmit }: ExamCountdownProps) {
  const router = useRouter();
  const deadline = React.useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [remainingMs, setRemainingMs] = React.useState(() =>
    Math.max(0, deadline - Date.now()),
  );
  const [submitting, setSubmitting] = React.useState(false);
  const attemptedRef = React.useRef(false);

  React.useEffect(() => {
    const update = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  React.useEffect(() => {
    if (!autoSubmit || remainingMs > 0 || attemptedRef.current) return;
    attemptedRef.current = true;
    setSubmitting(true);

    void finalizeExam(examId, { reason: "time_expired" }).then((result) => {
      setSubmitting(false);
      if (result.ok) {
        toast.info("Sinav suresi doldu", {
          description: "Kaydedilen cevaplariniz otomatik olarak teslim edildi.",
        });
        router.refresh();
        return;
      }

      toast.error("Otomatik teslim tamamlanamadi", {
        description: result.error,
      });
      router.refresh();
    });
  }, [autoSubmit, examId, remainingMs, router]);

  const urgent = remainingMs > 0 && remainingMs <= 5 * 60_000;
  const expired = remainingMs === 0;

  return (
    <div
      role="timer"
      aria-live={urgent || expired ? "polite" : "off"}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold tabular",
        urgent && "border-warning/40 bg-warning/10 text-warning",
        expired && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : expired ? (
        <TriangleAlert className="h-4 w-4" />
      ) : (
        <Clock3 className="h-4 w-4" />
      )}
      <span>
        {submitting
          ? "Otomatik teslim ediliyor..."
          : expired
            ? "Sure doldu"
            : `Kalan sure: ${formatRemaining(remainingMs)}`}
      </span>
    </div>
  );
}
