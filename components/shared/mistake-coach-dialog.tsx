"use client";

import * as React from "react";
import { BrainCircuit, Lightbulb, Loader2, Route, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MistakeCoachResult } from "@/lib/ai";
import type { ApiResponse } from "@/lib/types";

export function MistakeCoachDialog({
  examId,
  questionId,
  subject,
}: {
  examId: string;
  questionId: string;
  subject: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<MistakeCoachResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function createStudy() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/mistake-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, questionId }),
      });
      const payload = (await response.json()) as ApiResponse<MistakeCoachResult>;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Mini çalışma oluşturulamadı." : payload.error);
      }
      setResult(payload.data);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Mini çalışma oluşturulamadı.";
      setError(message);
      toast.error("AI çalışma desteği hazırlanamadı", { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <BrainCircuit className="h-4 w-4" />
          AI ile çalış
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="soft">{subject}</Badge>
            <Badge variant="outline">Kişisel mini çalışma</Badge>
          </div>
          <DialogTitle className="font-display text-xl">Yanlışın üzerinden öğren</DialogTitle>
          <DialogDescription>
            Resmî cevap anahtarını göstermeden; kazanım, kendi cevabın ve nihai
            geri bildirim üzerinden yeni bir çalışma oluşturur.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-primary" />
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              AI olası eksik noktayı açıklayacak, kısa çalışma adımları ve aynı
              kazanımı ölçen yeni bir alıştırma önerecek.
            </p>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <Button className="mt-5" disabled={pending} onClick={() => void createStudy()}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {pending ? "Hazırlanıyor…" : error ? "Yeniden dene" : "Mini çalışmayı hazırla"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border bg-muted/20 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-primary" />
                Kavramı yeniden kur
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {result.conceptSummary}
              </p>
            </section>

            <section className="rounded-xl border border-warning/25 bg-warning/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                Olası yanılgı
              </p>
              <p className="mt-2 text-sm leading-relaxed">{result.likelyMisconception}</p>
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Route className="h-4 w-4 text-primary" />
                Çalışma adımları
              </h3>
              <ol className="mt-3 space-y-2">
                {result.studySteps.map((step, index) => (
                  <li key={`${index}-${step}`} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Yeni alıştırma
              </p>
              <p className="mt-2 font-medium leading-relaxed">{result.practiceQuestion}</p>
              <div className="mt-3 rounded-lg bg-background/80 p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">İpucu:</strong> {result.hint}
              </div>
            </section>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Bu içerik yapay zekâ tarafından çalışma desteği amacıyla üretilir;
              olası yanılgı ifadesi kesin tanı değildir.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
