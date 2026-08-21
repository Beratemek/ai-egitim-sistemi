"use client";

import * as React from "react";
import {
  ArrowDownWideNarrow,
  Check,
  Loader2,
  Pencil,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DeneyapCategory } from "@/lib/deneyap";
import type { ApiResponse, GeneratedQuestion, QuestionOption } from "@/lib/types";

/** Tek tikla gonderilen hazir talimatlar. Anahtarlar API ile eslesir. */
const PRESETS: readonly { key: string; label: string; icon: LucideIcon }[] = [
  { key: "zorlastir", label: "Zorlastir", icon: TrendingUp },
  { key: "kolaylastir", label: "Kolaylastir", icon: TrendingDown },
  { key: "kisalt", label: "Kisalt", icon: ArrowDownWideNarrow },
  { key: "celdirici", label: "Celdiricileri guclendir", icon: Sparkles },
];

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export interface QuestionReviseDialogProps {
  question: GeneratedQuestion;
  /** Kacinci taslak - baslikta gosterilir. */
  index: number;
  /** Kaydedilen (elle duzenlenmis ya da revize edilmis) soruyu geri verir. */
  onSave: (question: GeneratedQuestion) => void;
  /** Revizyonda modele baglam olarak gonderilir. */
  kazanim?: string;
  context?: string;
  category?: DeneyapCategory;
}

/**
 * Soru duzenleme ve AI revizyon diyalogu.
 *
 * Iki yol bir arada:
 *   - ELLE: soru koku, siklar, dogru cevap ve rubrik dogrudan degistirilir
 *     (brifteki "egitmen duzenler" maddesi).
 *   - AI ILE: hazir talimat dugmeleri veya serbest metin; model soruyu
 *     yeniden yazar, sonuc ayni alanlara duser ve "geri al" ile donulebilir.
 *
 * Diyalog kapanmadan hicbir sey kalici degil; "Kaydet" basilinca cagiran
 * bilesene aktarilir.
 */
export function QuestionReviseDialog({
  question,
  index,
  onSave,
  kazanim,
  context,
  category,
}: QuestionReviseDialogProps) {
  const [open, setOpen] = React.useState(false);

  /** Uzerinde calisilan hal. Diyalog her acilista sifirlanir. */
  const [draft, setDraft] = React.useState<GeneratedQuestion>(question);
  /** AI revizyonundan onceki hal - "geri al" icin. */
  const [previous, setPrevious] = React.useState<GeneratedQuestion | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setDraft(question);
      setPrevious(null);
      setInstruction("");
      setError(null);
    }
  }

  function updateOption(key: string, text: string) {
    setDraft((current) => ({
      ...current,
      options: (current.options ?? []).map((option) =>
        option.key === key ? { ...option, text } : option,
      ),
    }));
  }

  /** Test sorusunda sik listesi eksikse dort satiri tamamlar. */
  const options: QuestionOption[] = React.useMemo(() => {
    if (draft.type !== "test") return [];
    const existing = draft.options ?? [];
    return OPTION_KEYS.map(
      (key) => existing.find((o) => o.key === key) ?? { key, text: "" },
    );
  }, [draft]);

  async function revise(preset?: string) {
    const freeText = instruction.trim();
    if (!preset && !freeText) {
      setError("Ne yapilmasini istediginizi secin ya da yazin.");
      return;
    }

    setPending(preset ?? "serbest");
    setError(null);

    try {
      const response = await fetch("/api/ai/revise-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: draft,
          ...(preset ? { preset } : {}),
          ...(freeText ? { instruction: freeText } : {}),
          ...(kazanim ? { kazanim } : {}),
          ...(context ? { context } : {}),
          ...(category ? { category } : {}),
        }),
      });

      const result = (await response.json()) as ApiResponse<GeneratedQuestion>;
      if (!result.ok) throw new Error(result.error);

      setPrevious(draft);
      setDraft(result.data);
      setInstruction("");
      toast.success("Soru revize edildi", {
        description: "Begenmezseniz 'Geri al' ile onceki hale donebilirsiniz.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Revizyon sirasinda hata olustu.";
      setError(message);
      toast.error("Revize edilemedi", { description: message });
    } finally {
      setPending(null);
    }
  }

  function save() {
    if (!draft.text.trim()) {
      setError("Soru koku bos olamaz.");
      return;
    }

    if (draft.type === "test") {
      const filled = options.filter((option) => option.text.trim());
      if (filled.length < 2) {
        setError("Coktan secmeli soruda en az iki sik dolu olmalidir.");
        return;
      }
      if (!draft.correct_answer) {
        setError("Dogru sikki secin.");
        return;
      }
      onSave({ ...draft, options: filled, rubric: null });
    } else {
      if (!draft.rubric?.trim()) {
        setError("Acik uclu soruda rubrik zorunludur.");
        return;
      }
      onSave({ ...draft, options: null, correct_answer: null });
    }

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
          <Pencil className="h-3.5 w-3.5" />
          Duzenle
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{index + 1}. soruyu duzenle</DialogTitle>
          <DialogDescription>
            Alanlari elle degistirebilir ya da AI&apos;a nasil duzeltmesini
            istediginizi soyleyebilirsiniz. Kaydetmeden hicbir sey kalici olmaz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ---------- Soru koku ---------- */}
          <div className="space-y-2">
            <Label htmlFor="revise-text">Soru koku</Label>
            <Textarea
              id="revise-text"
              rows={3}
              value={draft.text}
              onChange={(event) =>
                setDraft((current) => ({ ...current, text: event.target.value }))
              }
              className="resize-y"
            />
          </div>

          {/* ---------- Siklar / rubrik ---------- */}
          {draft.type === "test" ? (
            <div className="space-y-2">
              <Label>Secenekler</Label>
              <p className="text-xs text-muted-foreground">
                Dogru sikki isaretlemek icin soldaki harfe basin.
              </p>

              {options.map((option) => {
                const isCorrect = draft.correct_answer === option.key;

                return (
                  <div key={option.key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          correct_answer: option.key,
                        }))
                      }
                      aria-pressed={isCorrect}
                      aria-label={`${option.key} sikkini dogru cevap yap`}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border font-mono text-sm transition-colors",
                        isCorrect
                          ? "border-success bg-success/15 font-semibold text-success"
                          : "border-input text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {isCorrect ? <Check className="h-4 w-4" /> : option.key}
                    </button>
                    <Input
                      value={option.text}
                      onChange={(event) => updateOption(option.key, event.target.value)}
                      placeholder={`${option.key} sikkinin metni`}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="revise-rubric">Puanlama rubrigi</Label>
              <Textarea
                id="revise-rubric"
                rows={5}
                value={draft.rubric ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, rubric: event.target.value }))
                }
                placeholder="1. ... (40 puan)&#10;2. ... (40 puan)&#10;3. ... (20 puan)"
                className="resize-y font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Maddelerin puan toplami 100 olmalidir.
              </p>
            </div>
          )}

          <Separator />

          {/* ---------- AI revizyon ---------- */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">AI ile revize et</p>
              {previous ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto gap-1.5 text-xs text-muted-foreground"
                  onClick={() => {
                    setDraft(previous);
                    setPrevious(null);
                  }}
                  disabled={pending !== null}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Geri al
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <Button
                    key={preset.key}
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={pending !== null}
                    onClick={() => void revise(preset.key)}
                  >
                    {pending === preset.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    {preset.label}
                  </Button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="...ya da ne istediginizi yazin (ornek: sayisal bir ornek ekle)"
                className="flex-1"
                disabled={pending !== null}
              />
              <Button
                size="sm"
                className="gap-1.5"
                disabled={pending !== null || !instruction.trim()}
                onClick={() => void revise()}
              >
                {pending === "serbest" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Revize et
              </Button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending !== null}>
            Vazgec
          </Button>
          <Button className="gap-2" onClick={save} disabled={pending !== null}>
            <Check className="h-4 w-4" />
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
