"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import type {
  ApiResponse,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  QuestionType,
} from "@/lib/types";

type TypeChoice = QuestionType | "karisik";

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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Soru uretilirken bir hata olustu.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kazanimdan soru uret</CardTitle>
          <CardDescription>
            Kaynak metni ve kazanimi girin; model soru taslaklarini JSON olarak
            dondursun. Taslaklar egitmen onayina gonderilir.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="topic">Konu</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Fotosentez"
                />
              </div>

              <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label htmlFor="kazanim">Kazanim</Label>
              <Input
                id="kazanim"
                required
                value={kazanim}
                onChange={(event) => setKazanim(event.target.value)}
                placeholder="Ogrenci fotosentezin isik ve karanlik evrelerini aciklar."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="context">Kaynak metin</Label>
              <Textarea
                id="context"
                required
                rows={8}
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Sorularin uretilecegi ders metnini buraya yapistirin..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type">Soru tipi</Label>
              <Select
                id="type"
                value={type}
                onChange={(event) => setType(event.target.value as TypeChoice)}
                className="sm:w-56"
              >
                <option value="karisik">Karisik</option>
                <option value="test">Coktan secmeli</option>
                <option value="acik_uclu">Acik uclu</option>
              </Select>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? "Uretiliyor..." : "Soru uret"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Uretilen taslaklar ({results.length})
          </h2>

          <ul className="space-y-3">
            {results.map((question, index) => (
              <li key={`${question.text}-${index}`} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <QuestionTypeBadge type={question.type} />
                  <span className="text-xs text-muted-foreground">
                    {question.topic} &middot; {question.difficulty}
                  </span>
                </div>

                <p className="mt-2 font-medium">{question.text}</p>

                {question.type === "test" ? (
                  <ul className="mt-2 space-y-1">
                    {(question.options ?? []).map((option) => (
                      <li
                        key={option.key}
                        className={
                          option.key === question.correct_answer
                            ? "text-sm font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-sm text-muted-foreground"
                        }
                      >
                        <span className="mr-2 font-mono">{option.key})</span>
                        {option.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
                    {question.rubric}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
