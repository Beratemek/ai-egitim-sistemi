"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { saveGeneratedQuestions } from "@/app/actions/questions";
import { subjectKey } from "@/lib/subjects";
import { GeneratedQuestionCard } from "@/components/shared/generated-question-card";
import { OutcomeSearchField } from "@/components/shared/outcome-search-field";
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
  DifficultyChoice,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  LearningOutcome,
  PreferenceStats,
  QuestionPreference,
  QuestionType,
} from "@/lib/types";

type TypeChoice = QuestionType | "karisik";

/**
 * Kazanim secicisinde "kayitli kazanim kullanmiyorum" secenegi.
 *
 * Select bileseni bos dizeyi deger olarak kabul etmedigi icin ayri bir
 * anahtar kullaniliyor.
 */

/** "Daha fazla goster" ile her tiklamada kac taslak daha acilir (2 satir). */
const BATCH_SIZE = 4;

const DIFFICULTY_OPTIONS: readonly { value: DifficultyChoice; label: string }[] = [
  { value: "karisik", label: "Karisik" },
  { value: "kolay", label: "Kolay" },
  { value: "orta", label: "Orta" },
  { value: "zor", label: "Zor" },
];

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
  /** Tanimli kazanimlar; uretimin olcme hedefi buradan secilir. */
  outcomes?: readonly LearningOutcome[];
  /** AI'in bugune kadar ogrendigi örnek sayilari (ders kirilimiyla). */
  preferenceStats: PreferenceStats;
  /**
   * Modele ornek olarak giden begeni/red KAYITLARININ KENDISI.
   *
   * `preferenceStats` yalnizca sayi verir; bu liste tarz hafizasi panelinde
   * orneklerin metnini gostermek ve karari degistirebilmek icin gerekli.
   */
  preferences?: readonly QuestionPreference[];
  /** Supabase yoksa kaydetme kapali olur. */
  canPersist: boolean;
  /**
   * Baslangicta secili gelecek kazanim.
   *
   * Egitmen panelindeki kazanim analizinden "bu kazanima tekrar sorusu uret"
   * baglantisiyla geliniyor; hoca listede kazanimi tekrar aramak zorunda
   * kalmasin. Analiz -> uretim -> olcme -> analiz dongusunun kapandigi yer
   * burasi.
   */
  initialOutcomeId?: string;
}

/**
 * İçerik uzmaninin kaynak metin + kazanım girip AI'dan soru taslağı
 * uretmesini saglar.
 *
 * Üretilen her taslak begenilebilir/reddedilebilir; bu geri bildirim
 * `question_preferences` tablosuna yazilir ve bir sonraki üretimde AYNI
 * DERSIN uretiminde modele örnek olarak verilir. Begenilen taslaklar tek
 * tikla havuza gönderilir.
 */
export function QuestionGeneratorForm({
  subjects = [],
  outcomes = [],
  preferenceStats,
  preferences = [],
  canPersist,
  initialOutcomeId,
}: QuestionGeneratorFormProps) {
  const router = useRouter();
  /**
   * Adres satirindan gelen kazanim. Gecersiz kimlik sessizce yok sayilir -
   * eski bir baglanti ya da silinmis bir kazanim formu kilitlememeli.
   */
  const initialOutcome = initialOutcomeId
    ? outcomes.find((outcome) => outcome.id === initialOutcomeId)
    : undefined;

  const [subject, setSubject] = React.useState(initialOutcome?.subject ?? "");
  const [topic, setTopic] = React.useState(initialOutcome?.topic ?? "");
  /** Secili kazanim kaydi. Bos ise serbest metin kullanılıyor. */
  const [outcomeId, setOutcomeId] = React.useState(initialOutcome?.id ?? "");
  const [kazanim, setKazanim] = React.useState(initialOutcome?.outcome_text ?? "");
  const [context, setContext] = React.useState("");
  /**
   * Soru adedi Metin olarak tutulur: `Number(value) || 1` kalibi alanı
   * bosaltilir bosaltilmaz 1'e cevirdigi için kullanıcı istedigi sayiyi
   * yazamiyordu. Gonderirken sayiya cevrilip 1-20 araligina sikistirilir.
   */
  const [count, setCount] = React.useState("5");
  const [type, setType] = React.useState<TypeChoice>("karisik");
  const [difficulty, setDifficulty] = React.useState<DifficultyChoice>("karisik");

  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  /**
   * Kac taslak GORUNUR - hepsi degil.
   *
   * Once tum liste TEK SEFERDE, ic ice iki ayri kaydirma alaniyla
   * (sayfanin kendisi + sabit boylu bir kutu) gosteriliyordu. Iki bagimsiz
   * kaydirma alani ayni anda calisinca fare tekerlegi hangisine gittigini
   * karistiriyor, kartlar yari kesilmis gibi cakisik gorunuyordu - "bozuk"
   * hissi tam olarak buradan geliyordu.
   *
   * SONSUZ KAYDIRMA ile NESTED SCROLL BOX AYNI SEY DEGIL: buradaki "sonsuz
   * kaydirma", asagida bir gozlemci (IntersectionObserver) ile GORUNTU
   * ALANINA yaklasildikca otomatik daha fazla taslak acmak - kaydiran hep
   * SAYFANIN KENDISI, ayri bir kutu yok. Bu yuzden onceki "cift kaydirma"
   * sorunu geri gelmiyor.
   */
  const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);
  /** Sayfanin sonuna yaklasildigini yakalayan gorunmez isaretci. */
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  /** Toplu revizyon sırasında hangi talimat çalışıyor ve kacinci soruda. */
  const [bulkPreset, setBulkPreset] = React.useState<string | null>(null);
  const [bulkDone, setBulkDone] = React.useState(0);

  /**
   * Bu derste kac ornekten ogrenildi?
   *
   * Tarz hafizasi ders bazinda okunuyor; kullanıcının hangi havuzun
   * kullanılacağını üretimden ÖNCE görmesi gerekiyor. Sayilar sunucudan
   * ders kirilimiyla geldigi için ek istek yapilmiyor.
   */
  const scopedStats = subject.trim()
    ? preferenceStats.bySubject[subjectKey(subject)]
    : undefined;
  const globalTotal = preferenceStats.liked + preferenceStats.disliked;
  const scopedTotal = scopedStats ? scopedStats.liked + scopedStats.disliked : 0;

  /** Alan boş veya gecersizse 5'e düşer; her zaman 1-20 araliginda. */
  const resolvedCount = Math.min(Math.max(Number.parseInt(count, 10) || 5, 1), 20);

  /**
   * Kazanim listesi yazilan DERSE gore suzulur.
   *
   * Veritabaninda yuzlerce kazanim olabiliyor; hepsini tek bir acilir listeye
   * dizmek onu kullanilamaz kiliyordu. Iki koruma var:
   *
   *   - O derste hic kazanim yoksa suzme yapilmaz (liste bos kalmasin).
   *   - Secili kazanim her zaman listede tutulur. Kazanim secmek dersi de
   *     degistirdigi icin, suzme secili ogeyi listeden dusurebilir ve Select
   *     bos gorunurdu.
   */
  const visibleOutcomes = React.useMemo(() => {
    const key = subject.trim() ? subjectKey(subject) : null;
    if (!key) return outcomes;

    const matching = outcomes.filter(
      (outcome) => outcome.subject && subjectKey(outcome.subject) === key,
    );
    if (matching.length === 0) return outcomes;

    const hasSelected = matching.some((outcome) => outcome.id === outcomeId);
    if (hasSelected || !outcomeId) return matching;

    const selectedOutcome = outcomes.find((outcome) => outcome.id === outcomeId);
    return selectedOutcome ? [selectedOutcome, ...matching] : matching;
  }, [outcomes, subject, outcomeId]);

  /**
   * SONSUZ KAYDIRMA: asagidaki gorunmez isaretci EKRANA YAKLASINCA
   * (rootMargin sayesinde tam dibe gelmeden ONCEDEN) bir sonraki grup
   * acilir. Gozlemci HER ZAMAN sayfanin kendi kaydirmasini izler (varsayilan
   * `root: null`) - ayri bir kutu YOK, bu yuzden onceki cift kaydirma
   * sorunu geri gelmez.
   *
   * `visibleCount >= results.length` iken isaretci render edilmiyor
   * (asagida), o yuzden bu efekt de o durumda hicbir seye baglanmaz.
   */
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= results.length) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + BATCH_SIZE, results.length));
        }
      },
      // 150px: kullanici gercekten yaklasirken (tam dibe varmadan biraz
      // once) tetiklensin. Daha buyuk bir deger (or. 600px) sayfa ilk
      // acildiginda bile - hic kaydirilmadan - tum listeyi birden acabiliyor,
      // bu da "kademeli" hissi yok ediyor.
      { rootMargin: "150px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, results.length]);

  /**
   * Kazanim secildiginde ders ve konu KAZANIMDAN alinir.
   *
   * Kazanim kaydi bu ikisinin sahibi: elle yazilana izin verilirse havuzda
   * "Matematik kazanimi, Fizik dersine yazilmis" gibi tutarsiz satirlar
   * olusabilir. Secim geri alinirsa alanlar dokunulmadan kalir - kullanıcı
   * yazdigini kaybetmesin.
   */
  function handleOutcomeSelect(outcome: LearningOutcome | null) {
    if (!outcome) {
      // Secim kaldirildi: alanlar DOKUNULMADAN kalir, kullanici yazdigini
      // kaybetmesin. Metin artik serbest kazanim olarak gider.
      setOutcomeId("");
      return;
    }

    setOutcomeId(outcome.id);
    setKazanim(outcome.outcome_text);
    setTopic(outcome.topic);
    if (outcome.subject) setSubject(outcome.subject);

    // Kaynak metin de dolsun. Kazanim cumlesini elle yazmak kolay, uzun
    // kaynak metni bulup kopyalamak degil - tekrar kullanimin asil zahmeti
    // buydu ve kullanici yine kopyala-yapistir yapmak zorunda kaliyordu.
    if (outcome.source_text) setContext(outcome.source_text);
  }

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

    if (kazanim.trim().length === 0) {
      const message =
        "Kazanım zorunlu. Listeden bir kazanım seçin ya da serbest metin olarak yazın.";
      setError(message);
      toast.error("Kazanım eksik", { description: message });
      return;
    }

    setPending(true);
    setError(null);

    const payload: GenerateQuestionsRequest = {
      context,
      kazanim,
      topic: topic || undefined,
      // Ders gonderiliyor: tarz hafizasi bu dersin orneklerinden seciliyor.
      subject: subject || undefined,
      count: resolvedCount,
      type,
      difficulty,
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
      // Yeni parti geldi: onceki partiden acilmis kalan goruntu sayisi yeni
      // partiye tasinmasin, bastan basla.
      setVisibleCount(BATCH_SIZE);
      toast.success(`${body.data.length} soru taslağı üretildi`, {
        description:
          scopedTotal > 0
            ? `${subject} dersindeki ${scopedTotal} örnek dikkate alındı.`
            : globalTotal > 0
              ? "Bu derste örnek yok; genel örnekler kullanıldı."
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
      // Kazanim baglantisi: ogrencinin gelisim ekrani basariyi bununla kirar.
      ...(outcomeId ? { outcomeId } : {}),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error("Havuza gönderilemedi", { description: result.error });
      return;
    }

    toast.success(`${result.data.saved} soru havuza gönderildi`, {
      description: outcomeId
        ? "Kazanıma bağlandı; eğitmen onayından sonra sınavlarda kullanılabilir."
        : "Eğitmen onayından sonra sınavlarda kullanılabilir.",
    });

    // Kaydedilenleri listeden dus. Kalan sayi disaridan okunabilsin diye
    // fonksiyonel guncelleyicinin SONUCU disaridaki degiskene yaziliyor -
    // `results`'a dogrudan bakmak escik bir kapanis olurdu (bu handler
    // baslarken yakalandigi icin await sirasinda degismis olabilirdi).
    let remainingCount = 0;
    setResults((current) => {
      const remaining = current.filter((_, index) => !selected.has(index));
      remainingCount = remaining.length;
      return remaining;
    });
    setSelected(new Set());

    /*
      TUM TASLAKLAR ISLENDIYSE FORMU SIFIRLA.
      Onceden kaynak metin, kazanim ve konu kaydettikten sonra da ekranda
      kaliyordu; bir sonraki konuya gecmek icin hepsini elle silmek
      gerekiyordu. Ders BILEREK korunuyor - ayni derste ust uste birkac
      konu uretmek yaygin bir akis, sadece bu partiye ozgu alanlar
      sifirlaniyor.
    */
    if (remainingCount === 0) {
      setTopic("");
      setKazanim("");
      setOutcomeId("");
      setContext("");
    }
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
    <div className="space-y-6">
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
              Ölçülecek kazanımı seçin, kaynak metni girin.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              {/* ---------- Kazanım ---------- */}
              {/*
                Acilir liste KALDIRILDI. 60+ kazanimda kullanilmaz hale
                geliyordu: aradigini bulmak icin listeyi gozle taramak
                gerekiyordu. Yerine yazarken arayan bir alan geldi - ad
                ararken cikan oneriler gibi (bkz. OutcomeSearchField).
              */}
              <OutcomeSearchField
                value={kazanim}
                onValueChange={setKazanim}
                selectedId={outcomeId}
                onSelect={handleOutcomeSelect}
                outcomes={visibleOutcomes}
                subject={subject}
                topic={topic}
                onCreated={() => router.refresh()}
                disabled={pending}
              />

              <SourceTextField
                value={context}
                onChange={setContext}
                disabled={pending}
              />

              {/* ---------- Üretim ayarları ---------- */}
              <div className="grid gap-4 sm:grid-cols-3">
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
                      <SelectItem value="test">Çoktan seçmeli</SelectItem>
                      <SelectItem value="acik_uclu">Açık uçlu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Seviye</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(value) =>
                      setDifficulty(value as DifficultyChoice)
                    }
                  >
                    <SelectTrigger id="difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
          <div className="grid items-start gap-3 sm:grid-cols-2">
            {Array.from({ length: BATCH_SIZE }, (_, index) => (
              // exam-paper HER KARTIN KENDISINE uygulanir, ortak sarmalayiciya
              // degil - asagidaki asil listedeki gerekce burada da gecerli.
              <Card key={index} className="exam-paper">
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
          <>
            {/*
              IKI SUTUN, KADEMELI ACILAN LISTE.
              Once sinirli yukseklikte KENDI ICINDE kayan bir kutu vardi
              ("dosya gezgini gibi"). Bu, sayfanin kendi kaydirmasi ile
              kutunun ic kaydirmasi AYNI ANDA calisinca kafa karistirdi -
              fare tekerlegi hangisine gidiyor belli olmuyordu ve kartlar
              yari kesilmis/cakismis gibi gorunuyordu.

              Tek kaydirma alani (sayfanin kendisi) + kademeli acilan liste
              ayni sorunu (yirmiye kadar soru sayfayi "evrenin sonuna
              kadar" uzatiyordu) ic ice kaydirma OLMADAN cozer: varsayilan
              olarak yalnizca ilk `BATCH_SIZE` taslak gorunur, gerisi
              asagidaki isaretciye gore OTOMATIK acilir (bkz. yukaridaki
              IntersectionObserver efekti) - sayfa normal sekilde uzar, tek
              ve tanidik bir kaydirma davranisi olur.

              `items-start` + `min-h`: grid varsayilan olarak ayni satirdaki
              kartlari birbirine esitleyip KISA karti UZUN kartin (grafikli)
              boyuna kadar geriyordu - kisa kartin altinda bos, cirkin bir
              alan kaliyordu. `items-start` bu zorlamayi kaldirir; `min-h`
              ise TERS yonde asiriliga (bir metin karti bir grafik kartinin
              yaninda "cok kucuk" durmasi) karsi TABAN olusturur - kart
              icerigi tabani asarsa (grafik gibi) buyumeye devam eder, kisa
              bir kart ise en az bu boyda gorunur. Ikisi celismiyor: biri
              UST siniri kaldirir, digeri ALT siniri koyar.

              BEYAZ ZEMIN HER KARTIN KENDISINDE, ORTAK SARMALAYICIDA DEGIL.
              `.exam-paper` `<Card>`'in KENDISINE geciyor (cardClassName) -
              kartlar koyu zemin uzerinde ayri ayri duran beyaz adacıklar;
              aralardaki bosluk ve dis cerceve normal (koyu) arayuz
              renginde kalir.
            */}
            <ul className="grid items-start gap-3 sm:grid-cols-2">
              {results.slice(0, visibleCount).map((question, index) => (
                <li key={`${question.text}-${index}`}>
                  <GeneratedQuestionCard
                    question={question}
                    index={index}
                    selected={selected.has(index)}
                    onToggleSelected={(value) => toggleSelected(index, value)}
                    onReplace={(revised) => replaceResult(index, revised)}
                    cardClassName="exam-paper min-h-[19rem]"
                    {...(kazanim ? { kazanim } : {})}
                    {...(context ? { context } : {})}
                    {...(outcomeId ? { outcomeId } : {})}
                    {...(subject ? { subject } : {})}
                  />
                </li>
              ))}
            </ul>

            {visibleCount < results.length ? (
              <>
                {/* Gozle gorunur bir yukleniyor gostergesi yok: veri zaten
                    istemcide, ekleme aninda oluyor - bir spinner goze
                    carpip hemen kaybolurdu. */}
                <p className="text-center text-xs text-muted-foreground">
                  {results.length - visibleCount} soru daha var, aşağı
                  kaydırdıkça yüklenecek.
                </p>
                <div ref={sentinelRef} aria-hidden className="h-1" />
              </>
            ) : null}
          </>
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

      {/*
        AI tarz hafizasi TAM GENISLIKTE ve EN ALTTA.

        Once sol sutundaydi (xl:col-span-2): dar oldugu icin ornek metinleri
        uc satira sikisiyordu ve uretim yapilmadan once sagdaki taslak sutunu
        bombos duruyordu. Asagi alininca iki sorun birden cozuluyor - panel
        sayfanin tam genisligini kullaniyor, uretilen taslaklar da formun
        hemen yaninda kaliyor.
      */}
      <StyleMemoryPanel preferences={preferences} canPersist={canPersist} />
    </div>
  );
}
