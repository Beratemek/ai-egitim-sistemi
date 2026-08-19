"use client";

import * as React from "react";
import { Loader2, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ApiResponse,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  QuestionType,
} from "@/lib/types";

type TypeChoice = QuestionType | "karisik";

const DIFFICULTY_VARIANT: Record<
  GeneratedQuestion["difficulty"],
  "success" | "warning" | "destructive"
> = {
  kolay: "success",
  orta: "warning",
  zor: "destructive",
};

/**
 * Icerik uzmaninin kaynak metin + kazanim girip AI'dan soru taslagi
 * uretmesini saglar. Sonuclar egitmen onayina duser.
 */
export function QuestionGeneratorForm() {
  const [topic, setTopic] = React.useState("");
  const [kazanim, setKazanim] = React.useState("");
  const [context, setContext] = React.useState("");
  const [count, setCount] = React.useState(5);
  const [type, setType] = React.useState<TypeChoice>("karisik");

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GeneratedQuestion[]>([]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload: GenerateQuestionsRequest = {
      context,
      kazanim,
      topic: topic || undefined,
      count,
      type,
    };

    try {
      const response = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as ApiResponse<GeneratedQuestion[]>;

      if (!body.ok) throw new Error(body.error);

      setResults(body.data);
      toast.success(`${body.data.length} soru taslagi uretildi`, {
        description: "Taslaklar egitmen onayina gonderilmeye hazir.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Soru uretilirken bir hata olustu.";
      setError(message);
      toast.error("Soru uretilemedi", { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ---------- Form ---------- */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-4.5 w-4.5 text-primary" />
            Kazanimdan soru uret
          </CardTitle>
          <CardDescription>
            Kaynak metni ve kazanimi girin; model soru taslaklarini uretsin.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="topic">Konu</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Fotosentez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Soru adedi</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value) || 1)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kazanim">Kazanim</Label>
              <Input
                id="kazanim"
                required
                value={kazanim}
                onChange={(event) => setKazanim(event.target.value)}
                placeholder="Ogrenci fotosentezin isik ve karanlik evrelerini aciklar."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Kaynak metin</Label>
              <Textarea
                id="context"
                required
                rows={9}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Sorularin uretilecegi ders metnini buraya yapistirin..."
                className="resize-y"
              />
              <p className="text-xs text-muted-foreground">
                En az 20 karakter. Model yalnizca bu metinden dogrulanabilir sorular uretir.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Soru tipi</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as TypeChoice)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="karisik">Karisik</SelectItem>
                  <SelectItem value="test">Coktan secmeli</SelectItem>
                  <SelectItem value="acik_uclu">Acik uclu</SelectItem>
                </SelectContent>
              </Select>
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

            <Button type="submit" className="w-full gap-2" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uretiliyor...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Soru uret
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ---------- Sonuclar ---------- */}
      <div className="space-y-3 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uretilen taslaklar
          </h2>
          {results.length > 0 ? (
            <Badge variant="soft">{results.length} soru</Badge>
          ) : null}
        </div>

        {pending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : results.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium">Henuz soru uretilmedi</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Soldaki formu doldurup &quot;Soru uret&quot; butonuna basin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {results.map((question, index) => (
              <li key={`${question.text}-${index}`}>
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      <QuestionTypeBadge type={question.type} />
                      <Badge variant={DIFFICULTY_VARIANT[question.difficulty]}>
                        {question.difficulty}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {question.topic}
                      </span>
                    </div>

                    <p className="font-medium leading-relaxed">{question.text}</p>

                    {question.type === "test" ? (
                      <ul className="space-y-1">
                        {(question.options ?? []).map((option) => {
                          const isCorrect = option.key === question.correct_answer;

                          return (
                            <li
                              key={option.key}
                              className={cn(
                                "flex gap-2 rounded-md px-2 py-1.5 text-sm",
                                isCorrect
                                  ? "bg-success/10 font-medium text-success"
                                  : "text-muted-foreground",
                              )}
                            >
                              <span className="font-mono text-xs opacity-70">
                                {option.key})
                              </span>
                              {option.text}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-lg bg-muted/60 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Rubrik
                        </p>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {question.rubric}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
