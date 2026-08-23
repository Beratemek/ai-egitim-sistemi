"use client";

import * as React from "react";
import {
  Loader2,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { saveGeneratedQuestions } from "@/app/actions/questions";
import {
  DENEYAP_CATEGORY_OPTIONS,
  categoryLabel,
  type DeneyapCategory,
} from "@/lib/deneyap";
import { GeneratedQuestionCard } from "@/components/shared/generated-question-card";
import { SourceTextField } from "@/components/shared/source-text-field";
import { StyleMemoryPanel } from "@/components/shared/style-memory-panel";
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
import type {
  ApiResponse,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  LearningOutcome,
  QuestionPreference,
  QuestionType,
} from "@/lib/types";

type TypeChoice = QuestionType | "karisik";

/**
 * Toplu revizyon dugmeleri. Serbest metin bilincli olarak Yok: "sunu sunu
 * degistir" gibi tek soruya ozgu talimatlar toplu isleme uygun değil, onlar
 * kart icindeki düzenleme diyalogunda veriliyor.
 */
const BULK_PRESETS: readonly { key: string; label: string }[] = [
  { key: "zorlastir", label: "Zorlastir" },
  { key: "kolaylastir", label: "Kolaylastir" },
  { key: "kisalt", label: "Kisalt" },
  { key: "celdirici", label: "Celdirici+" },
];

export interface QuestionGeneratorFormProps {
  /** Havuzda halihazirda kullanılan ders adlari; öneri olarak sunulur. */
  subjects?: readonly string[];
  /**
   * Veritabanina kayitli kazanimlar.
   *
   * Bunlar bir arsiv degil, YENIDEN KULLANILACAK girdiler: uzman daha once
   * yukledigi bir kazanimi secince form (dal, konu, kazanim, kaynak metin)
   * tek hamlede doluyor. Onceden sayfanin dibinde yalnizca listeleniyorlardi
   * ve tekrar soru uretmek icin metni elle kopyalamak gerekiyordu.
   */
  outcomes?: readonly LearningOutcome[];
  /** Modele ornek olarak giden begeni/red kayitlari. */
  preferences?: readonly QuestionPreference[];
  /** Supabase yoksa kaydetme kapali olur. */
  canPersist: boolean;
}

/**
 * İçerik uzmaninin kaynak metin + kazanım girip AI'dan soru taslağı
 * uretmesini saglar.
 *
 * Üretilen her taslak begenilebilir/reddedilebilir; bu geri bildirim
 * `question_preferences` tablosuna yazilir ve bir sonraki üretimde modele
 * örnek olarak verilir. Begenilen taslaklar tek tikla havuza gönderilir.
 */
export function QuestionGeneratorForm({
  subjects = [],
  outcomes = [],
  preferences = [],
  canPersist,
}: QuestionGeneratorFormProps) {
  /** DENEYAP atölye dalı - üretilen sorular bu dala baglanir. */
  const [category, setCategory] = React.useState<DeneyapCategory | "">("");
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [kazanim, setKazanim] = React.useState("");
  const [context, setContext] = React.useState("");
  /**
   * Soru adedi Metin olarak tutulur: `Number(value) || 1` kalibi alanı
   * bosaltilir bosaltilmaz 1'e cevirdigi için kullanıcı istedigi sayiyi
   * yazamiyordu. Gonderirken sayiya cevrilip 1-20 araligina sikistirilir.
   */
  const [count, setCount] = React.useState("5");
  const [type, setType] = React.useState<TypeChoice>("karisik");

  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  /** Toplu revizyon sırasında hangi talimat çalışıyor ve kacinci soruda. */
  const [bulkPreset, setBulkPreset] = React.useState<string | null>(null);
  const [bulkDone, setBulkDone] = React.useState(0);

  const likedCount = preferences.filter((item) => item.verdict === "begendi").length;
  const dislikedCount = preferences.length - likedCount;
  const learnedTotal = preferences.length;

  /**
   * Kayitli bir kazanimi forma yazar.
   *
   * Kaynak metin de doldurulur - asil zahmet oydu; kazanim cumlesini elle
   * yazmak kolay, uzun kaynak metni bulup kopyalamak degil.
   */
  function applyOutcome(outcomeId: string) {
    const outcome = outcomes.find((item) => item.id === outcomeId);
    if (!outcome) return;

    setKazanim(outcome.outcome_text);
    setContext(outcome.source_text);
    setTopic(outcome.topic);
    if (outcome.category) setCategory(outcome.category);

    toast.success("Kazanım forma yüklendi", {
      description: `${outcome.topic} — kaynak metin de dolduruldu.`,
    });
  }

  /** Alan boş veya gecersizse 5'e düşer; her zaman 1-20 araliginda. */
  const resolvedCount = Math.min(Math.max(Number.parseInt(count, 10) || 5, 1), 20);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Metin alanı sekmelerden birinde gizli kalabildigi için dogrulama burada.
    if (context.trim().length < 20) {
      const message =
        "Kaynak metin en az 20 karakter olmalıdır. Metni yapıştırın ya da bir dosya yükleyin.";
      setError(message);
      toast.error("Kaynak metin eksik", { description: message });
      return;
    }

    setPending(true);
    setError(null);

    const payload: GenerateQuestionsRequest = {
      context,
      kazanim,
      topic: topic || undefined,
      ...(category ? { category } : {}),
      count: resolvedCount,
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
      toast.success(`${body.data.length} soru taslağı üretildi`, {
        description:
          learnedTotal > 0
            ? `${likedCount} beğeni ve ${dislikedCount} red örneği dikkate alındı.`
            : "Taslakları beğenerek AI'a tarzınızı öğretebilirsiniz.",
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Soru üretilirken bir hata oluştu.";
      setError(message);
      toast.error("Soru üretilemedi", { description: message });
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
      toast.error("Önce en az bir soru seçin");
      return;
    }

    setSaving(true);
    const result = await saveGeneratedQuestions({
      questions: chosen,
      subject,
      topic,
      ...(category ? { category } : {}),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("Havuza gönderilemedi", { description: result.error });
      return;
    }

    toast.success(`${result.data.saved} soru havuza gönderildi`, {
      description: "Eğitmen onayından sonra sınavlarda kullanılabilir.",
    });

    // Kaydedilenleri listeden dus
    setResults((current) => current.filter((_, index) => !selected.has(index)));
    setSelected(new Set());
  }

  /** Duzenlenen ya da revize edilen taslağı listede yerine koyar. */
  function replaceResult(index: number, revised: GeneratedQuestion) {
    setResults((current) =>
      current.map((item, position) => (position === index ? revised : item)),
    );
  }

  /**
   * Seçili taslakları ayni talimatla revize eder.
   *
   * Cagrilar SIRAYLA yapiliyor: ucretsiz katmanda dakika basina istek sınırı
   * var, hepsini paralel gondermek kotayi bir kerede tuketiyor. İlerleme
   * kullaniciya "2/3" seklinde gösterilir.
   */
  async function bulkRevise(preset: string) {
    const indexes = [...selected].sort((a, b) => a - b);
    if (indexes.length === 0) return;

    setBulkPreset(preset);
    setBulkDone(0);

    let failed = 0;

    for (const index of indexes) {
      const question = results[index];
      if (!question) continue;

      try {
        const response = await fetch("/api/ai/revise-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            preset,
            ...(kazanim ? { kazanim } : {}),
            ...(context ? { context } : {}),
            ...(category ? { category } : {}),
          }),
        });

        const result = (await response.json()) as ApiResponse<GeneratedQuestion>;
        if (!result.ok) throw new Error(result.error);

        replaceResult(index, result.data);
      } catch {
        failed += 1;
      }

      setBulkDone((done) => done + 1);
    }

    setBulkPreset(null);
    setBulkDone(0);

    if (failed === 0) {
      toast.success(`${indexes.length} soru revize edildi`);
    } else {
      toast.warning(`${indexes.length - failed} soru revize edildi`, {
        description: `${failed} soruda hata oluştu, tekrar deneyebilirsiniz.`,
      });
    }
  }

  function toggleSelected(index: number, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  /** Hepsi seciliyse temizler, degilse hepsini secer. */
  function toggleSelectAll() {
    setSelected((current) =>
      current.size === results.length
        ? new Set()
        : new Set(results.map((_, index) => index)),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* ---------- Sol: form ---------- */}
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-4.5 w-4.5 text-primary" />
              Kazanımdan soru üret
            </CardTitle>
            <CardDescription>
              Konu ve kazanımı yazın, kaynak metni girin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Atölye dalı</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as DeneyapCategory)}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="DENEYAP dalı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {DENEYAP_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Üretilen sorular bu dala kaydedilir; havuz dal bazinda filtrelenir.
                </p>
              </div>

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
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                    onBlur={() => setCount(String(resolvedCount))}
                  />
                </div>
              </div>

              {/*
                Kayitli kazanimdan doldurma.

                Kazanimlar sayfanin dibinde salt okunur listeleniyordu; ayni
                kazanimdan yeniden soru uretmek icin metni elle kopyalamak
                gerekiyordu. Secim formu tek hamlede dolduruyor - kaynak metin
                dahil, cunku asil zahmet oydu.
              */}
              {outcomes.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="kayitli-kazanim">Kayıtlı kazanımdan doldur</Label>
                  <Select value="" onValueChange={applyOutcome}>
                    <SelectTrigger id="kayitli-kazanim">
                      <SelectValue placeholder={`${outcomes.length} kayıtlı kazanım`} />
                    </SelectTrigger>
                    <SelectContent>
                      {outcomes.map((outcome) => (
                        <SelectItem key={outcome.id} value={outcome.id}>
                          {outcome.topic} — {kisalt(outcome.outcome_text, 60)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Dal, konu, kazanım ve kaynak metni birlikte doldurur.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="kazanim">Kazanım</Label>
                <Input
                  id="kazanim"
                  required
                  value={kazanim}
                  onChange={(event) => setKazanim(event.target.value)}
                  placeholder="Öğrenci fotosentezin evrelerini açıklar."
                />
              </div>

              <SourceTextField
                value={context}
                onChange={setContext}
                disabled={pending}
              />

              <div className="space-y-2">
                <Label htmlFor="type">Soru tipi</Label>
                <Select value={type} onValueChange={(value) => setType(value as TypeChoice)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="karisik">Karisik</SelectItem>
                    <SelectItem value="test">Çoktan seçmeli</SelectItem>
                    <SelectItem value="acik_uclu">Açık uçlu</SelectItem>
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
                    Soru üret
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ---------- Ogrenme durumu ---------- */}
        <StyleMemoryPanel preferences={preferences} canPersist={canPersist} />
      </div>

      {/* ---------- Sag: sonuçlar ---------- */}
      <div className="space-y-3 xl:col-span-3">
        {/*
          Bu cubuk bilerek YAPISKAN DEGIL: panelin kendi basligi zaten
          `sticky top-0 z-20` ile duruyor, ikinci bir yapiskan seride onun
          altina girer ve iki katmanli bir baslik olusurdu. Uzun listede
          asagidan onaylama ihtiyacini alttaki eylem cubugu karsiliyor.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Üretilen taslaklar
          </h2>

          {/*
            Burada YALNIZCA secim ozeti var, onay dugmesi yok.

            "Havuza gonder" bir sure ikisinde birden duruyordu; kisa listede
            iki ayni dugme birkac santim arayla gorunuyordu. Onay tek yerde:
            alttaki eylem cubugu, secim yapilir yapilmaz beliriyor.
          */}
          {results.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="soft">
                {selected.size} / {results.length} seçili
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={toggleSelectAll}
              >
                {selected.size === results.length
                  ? "Seçimi temizle"
                  : "Tümünü seç"}
              </Button>
            </div>
          ) : null}
        </div>

        {/*
          Kartlardan kaldirilan aciklama burada BIR KEZ duruyor; on soruluk
          listede ayni cumleyi on kez okutmanin anlami yoktu.
        */}
        {results.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Beğeniniz AI&apos;ın bir sonraki üretimini şekillendirir. Havuza
            yalnızca seçili taslaklar gönderilir.
          </p>
        ) : null}

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
          // Kutu bilerek bir tik yuksek: form sutunu yaninda cok kisa
          // kalinca sag taraf "bos birakilmis" gibi duruyordu.
          <Card className="border-dashed">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-2 py-16 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium">Henuz soru uretilmedi</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Soldaki formu doldurup &quot;Soru üret&quot; butonuna basın.
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
                  onReplace={(revised) => replaceResult(index, revised)}
                  {...(kazanim ? { kazanim } : {})}
                  {...(context ? { context } : {})}
                  {...(category ? { category, categoryName: categoryLabel(category) } : {})}
                />
              </li>
            ))}
          </ul>
        )}

        {/*
          Toplu eylem cubugu: 2+ taslak secilince görünür ve ekranin altina
          yapisir. Kartlarin her birine dort dugme koymak yerine boyle
          yapildi - varsayilan gorunum temiz kaliyor, toplu is de mumkun.
        */}
        {selected.size >= 1 ? (
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {selected.size} soru seçili
            </span>

            {bulkPreset ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {bulkDone} / {selected.size} revize edildi
              </span>
            ) : null}

            <div className="ml-auto flex flex-wrap gap-2">
              {/*
                Toplu revizyon tek soruda anlamsiz: "hepsini zorlastir" bir
                taslak icin kartin kendi Duzenle dugmesinin isi. 2+ secimde
                gorunur, tek secimde yalnizca "Havuza gonder" kalir.
              */}
              {selected.size >= 2
                ? BULK_PRESETS.map((preset) => (
                    <Button
                      key={preset.key}
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={bulkPreset !== null || saving}
                      onClick={() => void bulkRevise(preset.key)}
                    >
                      {bulkPreset === preset.key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {preset.label}
                    </Button>
                  ))
                : null}

              {/*
                Onay eylemi de bu cubukta: uzun bir listede asagida calisirken
                onaylamak icin basliga kadar geri donmek gerekiyordu.
              */}
              <Button
                size="sm"
                className="gap-1.5"
                disabled={saving || bulkPreset !== null || !canPersist}
                onClick={() => void handleSaveSelected()}
                title={canPersist ? undefined : "Tanıtım modunda kayıt yapılmaz"}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                Havuza gönder
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Uzun kazanim metnini secim listesinde tek satira sigdirir. */
function kisalt(text: string, limit: number): string {
  const temiz = text.trim();
  return temiz.length <= limit ? temiz : `${temiz.slice(0, limit - 1)}…`;
}
