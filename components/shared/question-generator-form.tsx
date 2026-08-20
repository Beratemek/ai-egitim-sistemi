"use client";

import * as React from "react";
import {
  Brain,
  Loader2,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { saveGeneratedQuestions } from "@/app/actions/questions";
import { GeneratedQuestionCard } from "@/components/shared/generated-question-card";
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
import type {
  ApiResponse,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  LearningOutcome,
  QuestionType,
} from "@/lib/types";

type TypeChoice = QuestionType | "karisik";

export interface QuestionGeneratorFormProps {
  /** Uretilen sorularin baglanacagi kazanim secenekleri. */
  outcomes: LearningOutcome[];
  /** Havuzda halihazirda kullanilan ders adlari; yazim birligi icin oneri olarak sunulur. */
  subjects?: readonly string[];
  /** AI'in bugune kadar ogrendigi ornek sayilari. */
  preferenceStats: { liked: number; disliked: number };
  /** Supabase yoksa kaydetme kapali olur. */
  canPersist: boolean;
}

const NO_OUTCOME = "yok";

/**
 * Icerik uzmaninin kaynak metin + kazanim girip AI'dan soru taslagi
 * uretmesini saglar.
 *
 * Uretilen her taslak begenilebilir/reddedilebilir; bu geri bildirim
 * `question_preferences` tablosuna yazilir ve bir sonraki uretimde modele
 * ornek olarak verilir. Begenilen taslaklar tek tikla havuza gonderilir.
 */
export function QuestionGeneratorForm({
  outcomes,
  subjects = [],
  preferenceStats,
  canPersist,
}: QuestionGeneratorFormProps) {
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [kazanim, setKazanim] = React.useState("");
  const [context, setContext] = React.useState("");
  const [count, setCount] = React.useState(5);
  const [type, setType] = React.useState<TypeChoice>("karisik");
  const [outcomeId, setOutcomeId] = React.useState<string>(NO_OUTCOME);

  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());

  const learnedTotal = preferenceStats.liked + preferenceStats.disliked;

  /** Kazanim secilince konu/kazanim/metin alanlarini doldurur. */
  function applyOutcome(id: string) {
    setOutcomeId(id);
    const outcome = outcomes.find((item) => item.id === id);
    if (!outcome) return;

    setTopic(outcome.topic);
    setKazanim(outcome.outcome_text);
    if (outcome.source_text) setContext(outcome.source_text);
  }

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
      setSelected(new Set());
      toast.success(`${body.data.length} soru taslagi uretildi`, {
        description:
          learnedTotal > 0
            ? `${preferenceStats.liked} begeni ve ${preferenceStats.disliked} red ornegi dikkate alindi.`
            : "Taslaklari begenerek AI'a tarzinizi ogretebilirsiniz.",
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

  async function handleSaveSelected() {
    const chosen = [...selected]
      .sort((a, b) => a - b)
      .map((index) => results[index])
      .filter((question): question is GeneratedQuestion => question !== undefined);

    if (chosen.length === 0) {
      toast.error("Once en az bir soru secin");
      return;
    }

    setSaving(true);
    const result = await saveGeneratedQuestions({
      questions: chosen,
      subject,
      topic,
      ...(outcomeId !== NO_OUTCOME ? { outcomeId } : {}),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("Havuza gonderilemedi", { description: result.error });
      return;
    }

    toast.success(`${result.data.saved} soru havuza gonderildi`, {
      description: "Egitmen onayindan sonra sinavlarda kullanilabilir.",
    });

    // Kaydedilenleri listeden dus
    setResults((current) => current.filter((_, index) => !selected.has(index)));
    setSelected(new Set());
  }

  function toggleSelected(index: number, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* ---------- Sol: form ---------- */}
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-4.5 w-4.5 text-primary" />
              Kazanimdan soru uret
            </CardTitle>
            <CardDescription>
              Kayitli bir kazanim secin ya da alanlari elle doldurun.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {outcomes.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="outcome">Kayitli kazanim</Label>
                  <Select value={outcomeId} onValueChange={applyOutcome}>
                    <SelectTrigger id="outcome">
                      <SelectValue placeholder="Kazanim secin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OUTCOME}>Kazanim secme (elle gir)</SelectItem>
                      {outcomes.map((outcome) => (
                        <SelectItem key={outcome.id} value={outcome.id}>
                          {outcome.topic} — {outcome.outcome_text.slice(0, 40)}
                          {outcome.outcome_text.length > 40 ? "..." : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="subject">Ders</Label>
                  <Input
                    id="subject"
                    required
                    list="ders-onerileri"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Matematik"
                  />
                  <datalist id="ders-onerileri">
                    {subjects.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic">Konu</Label>
                  <Input
                    id="topic"
                    required
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Trigonometri"
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

              <p className="text-xs text-muted-foreground">
                <strong>Ders</strong> ve <strong>Konu</strong> havuzun anahtaridir:
                onayladiginiz sorular egitmenin havuzunda bu ders kutucugunun
                altindaki bu konuda listelenir. Ders havuzda yoksa kutucugu
                kendiliginden olusur; sorusu kalmayan ders kutucugu ise gorunmez.
              </p>

              <div className="space-y-2">
                <Label htmlFor="kazanim">Kazanim</Label>
                <Input
                  id="kazanim"
                  required
                  value={kazanim}
                  onChange={(event) => setKazanim(event.target.value)}
                  placeholder="Ogrenci fotosentezin evrelerini aciklar."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Kaynak metin</Label>
                <Textarea
                  id="context"
                  required
                  rows={8}
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
                <Select value={type} onValueChange={(value) => setType(value as TypeChoice)}>
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

        {/* ---------- Ogrenme durumu ---------- */}
        <Card className={learnedTotal > 0 ? "border-primary/30" : undefined}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">AI tarz hafizasi</p>
                {learnedTotal === 0 ? (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Henuz ornek yok. Uretilen taslaklari begenip reddettikce AI
                    sizin soru tarzinizi ogrenir ve sonraki uretimlerde ona yaklasir.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Bir sonraki uretimde bu ornekler modele veriliyor.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="success">{preferenceStats.liked} begeni</Badge>
                      <Badge variant="danger">{preferenceStats.disliked} red</Badge>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Sag: sonuclar ---------- */}
      <div className="space-y-3 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Uretilen taslaklar
          </h2>

          {results.length > 0 ? (
            <div className="flex items-center gap-2">
              <Badge variant="soft">{selected.size} / {results.length} secili</Badge>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={saving || selected.size === 0 || !canPersist}
                onClick={() => void handleSaveSelected()}
                title={
                  canPersist ? undefined : "Kaydetmek icin Supabase baglantisi gerekiyor"
                }
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                Havuza gonder
              </Button>
            </div>
          ) : null}
        </div>

        {pending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-5 w-40" />
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
                <GeneratedQuestionCard
                  question={question}
                  index={index}
                  selected={selected.has(index)}
                  onToggleSelected={(value) => toggleSelected(index, value)}
                  {...(outcomeId !== NO_OUTCOME ? { outcomeId } : {})}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
