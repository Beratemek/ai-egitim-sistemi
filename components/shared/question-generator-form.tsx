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
import type { ModelCatalog } from "@/lib/ai-model-catalog";
import type { AiProvider } from "@/lib/ai-providers";
import { subjectKey } from "@/lib/subjects";
import { GeneratedQuestionCard } from "@/components/shared/generated-question-card";
import { ModelCombobox } from "@/components/shared/model-combobox";
import { OutcomeSearchField } from "@/components/shared/outcome-search-field";
import { SourceTextField } from "@/components/shared/source-text-field";
import { StyleMemoryPanel } from "@/components/shared/style-memory-panel";
import { SubjectCombobox } from "@/components/shared/subject-combobox";
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

/** Yukleniyor iskeletinde kac sahte kart gosterilir (2 sutun x 2 satir). */
const ISKELET_SAYISI = 4;

/**
 * Taslak listesinin "A4 sayfasi" kutusu.
 *
 * Olculer BILEREK mm cinsinden: `210mm x 297mm` A4'un ta kendisi, yani kutu
 * ekranda gercekten bir sayfa kadar. Tarayici mm'yi 96dpi'a gore cevirir
 * (210mm ~ 794px), o yuzden pikselle ugrasmak gerekmiyor ve niyet koda
 * yaziliyor.
 *
 * Iki detay onemli:
 *
 *   `h-` (max-h- DEGIL) - kutu SABIT boyda. Onceki denemede `max-h` vardi;
 *   o yalnizca bir ust sinir koyuyor, kutu icerik kadar buyuyup kucululuyordu
 *   ve "sayfa alta dogru uzuyor" sikayeti aynen duruyordu. Sabit boyda 3 soru
 *   da 20 soru da AYNI kutuda duruyor - dosya gezgini penceresi gibi.
 *
 *   `min(297mm, 78vh)` - kisa ekranlarda tam A4 boyu (~1123px) pencereyi
 *   asar ve kutunun kendi kaydirmasi ise yaramaz hale gelirdi; bu yuzden boy
 *   her zaman goruntu alanina sigar. Genis ekranda gercek A4'e cikar.
 *
 * Ayni olcu iskelette ve bos durumda da kullaniliyor: uretim baslayip
 * bitince kutu boyu degismedigi icin sayfa ziplayamiyor.
 */
const SAYFA_KUTUSU = "mx-auto h-[min(297mm,78vh)] w-full max-w-[210mm]";

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
  /**
   * Havuzda halihazirda kullanilan konular, DERSIYLE birlikte.
   *
   * Ders bilgisi tasiniyor cunku oneriler secili derse gore suzuluyor:
   * Cografya yazan birine Trigonometri onerilmemeli.
   */
  topics?: readonly { subject: string; topic: string }[];
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
   * Tanimli API anahtarlarinin ERISEBILDIGI modeller, saglayiciya gore gruplu.
   *
   * Birden fazla saglayici anahtari tanimliysa hepsi ayni listede cikar; secilen
   * modelin saglayicisi istekle birlikte gider ve dogru anahtar kullanilir.
   * Liste alinamazsa (anahtar yok, ag hatasi) gruplar bos gelir ve form
   * yalnizca varsayilan modeli gosterir.
   */
  modelCatalog: ModelCatalog;
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
  topics = [],
  outcomes = [],
  preferenceStats,
  preferences = [],
  canPersist,
  modelCatalog,
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
  /**
   * Secilebilir model gruplari.
   *
   * Modeli olmayan gruplar eleniyor: secilemeyecek bir saglayici basligi
   * gostermek, sonra "model yok" demekten kotudur.
   */
  const availableGroups = React.useMemo(
    () => modelCatalog.groups.filter((group) => group.models.length > 0),
    [modelCatalog],
  );

  const totalModelCount = availableGroups.reduce(
    (sum, group) => sum + group.models.length,
    0,
  );

  /**
   * Secili model ve saglayicisi.
   *
   * Ikisi BIRLIKTE tutuluyor: ayni model adi iki saglayicida gecebiliyor
   * (or. "gpt-4o-mini" hem OpenAI hem OpenRouter listesinde), yalnizca ad
   * tasinsa hangi anahtarla cagrilacagi belirsiz kalirdi.
   *
   * Baslangic degeri sistem yoneticisinin panelde sectigi saglayici + modeldir.
   * Liste onu icermiyorsa (or. saglayici o modeli kapatmis) ilk secenege
   * dusulur - aksi halde kutu bos bir deger tasir ve sessizce bozulur.
   */
  /** Baslangicta secili gelecek grup: panelde varsayilan olan, yoksa ilki. */
  const initialGroup = React.useMemo(
    () =>
      availableGroups.find(
        (group) => group.provider === modelCatalog.defaultProvider,
      ) ??
      availableGroups[0] ??
      null,
    [availableGroups, modelCatalog.defaultProvider],
  );

  const [providerId, setProviderId] = React.useState<AiProvider>(
    () => initialGroup?.provider ?? modelCatalog.defaultProvider,
  );

  const [modelId, setModelId] = React.useState(() =>
    initialGroup?.models.some((model) => model.id === modelCatalog.defaultModel)
      ? modelCatalog.defaultModel
      : (initialGroup?.models[0]?.id ?? modelCatalog.defaultModel),
  );

  const selectedModel =
    availableGroups
      .find((group) => group.provider === providerId)
      ?.models.find((model) => model.id === modelId) ?? null;

  function changeModel(nextProvider: AiProvider, nextModel: string): void {
    setProviderId(nextProvider);
    setModelId(nextModel);
  }

  const [pending, setPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GeneratedQuestion[]>([]);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
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
   * Konu onerileri, SECILI DERSE gore suzulur.
   *
   * Kazanim listesindeki mantigin aynisi ve ayni sebeple: havuzda yuzlerce
   * konu birikiyor, hepsini tek listede gostermek oneriyi kullanilamaz
   * kiliyor. "Cografya" yazan birine "Trigonometri" onerilmemeli.
   *
   * Ders BOSSA ya da o derste hic konu yoksa suzme yapilmaz - bos bir oneri
   * listesi, oneri olmamasindan daha kotu. Ilk kez bir ders adi yazan
   * kullanici yine de gecmis konularini gorebilsin.
   *
   * Karsilastirma `subjectKey` ile: "cografya" yazan biri "Coğrafya"
   * altindaki konulari gormeli - buyuk/kucuk harf ve Turkce karakter farki
   * yuzunden liste bos kalmasin.
   */
  const konuOnerileri = React.useMemo(() => {
    const key = subject.trim() ? subjectKey(subject) : null;
    const derstekiler = key
      ? topics.filter((item) => item.subject && subjectKey(item.subject) === key)
      : [];

    const kaynak = derstekiler.length > 0 ? derstekiler : topics;
    return [...new Set(kaynak.map((item) => item.topic))];
  }, [topics, subject]);

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

  /*
    Kademeli acilma (IntersectionObserver) KALDIRILDI: taslak listesi artik
    kendi icinde kayan sinirli yukseklikte bir kutuda duruyor (asagi bkz.),
    yani "sayfa evrenin sonuna kadar uzuyor" sorunu kutunun kendisiyle
    cozuluyor. Ikisini birlikte tutmak ayni isi iki kez yapmak olurdu.
  */

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

    /*
      Ders ve konu dogrulamasi BURADA.

      Eskiden `<input required>` ile tarayiciya birakilmisti; alanlar
      SubjectCombobox'a gecince o oznitelik dustu. Kontrolu js'e almak
      zorunluydu: dersi bos birakan bir uretim havuza KAYDEDILEMIYOR
      (saveGeneratedQuestions "Ders alani zorunlu" der) ve konusuz sorular
      havuzda "Konusuz" kovasinda birikiyor. Yani uretim bosa gidiyordu.
    */
    if (subject.trim().length === 0) {
      const message = "Ders zorunlu. Soruların hangi derse yazılacağını belirtin.";
      setError(message);
      toast.error("Ders eksik", { description: message });
      return;
    }

    if (topic.trim().length === 0) {
      const message =
        "Konu zorunlu. Havuz ders ve konu başlıkları altında kırılıyor.";
      setError(message);
      toast.error("Konu eksik", { description: message });
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
      // Model ve saglayici BIRLIKTE gidiyor; sunucu saglayicinin anahtarini
      // dogrulayip o anahtarla cagiriyor.
      ...(selectedModel
        ? { model: selectedModel.id, provider: providerId }
        : {}),
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
                {/*
                  Ikisi de SubjectCombobox: daha once girilmis degerler
                  yazdikca altta beliriyor - kazanim alanindaki davranisin
                  aynisi. Native <datalist> KALDIRILDI; eslesmeyi tarayici
                  yapiyordu ve kurali Turkce degildi ("kayaclar" yazana
                  "Kayaçlar" cikmiyordu). Ustelik tarayicinin KENDI otomatik
                  doldurmasi (daha once form gonderirken yazdiklariniz) ayni
                  anda aciliyor ve iki liste birbirine kariyordu.
                */}
                <div className="space-y-2">
                  <Label htmlFor="subject">Ders</Label>
                  <SubjectCombobox
                    id="subject"
                    value={subject}
                    onChange={setSubject}
                    options={subjects}
                    placeholder="Matematik"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic">Konu</Label>
                  <SubjectCombobox
                    id="topic"
                    value={topic}
                    onChange={setTopic}
                    options={konuOnerileri}
                    listLabel="Eşleşen konular"
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
                    <SelectContent side="bottom" avoidCollisions={false}>
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
                    <SelectContent side="bottom" avoidCollisions={false}>
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ---------- Model ----------
                  TEK kutu, saglayiciya gore kategorili, aramali. Uc sutunlu
                  izgaraya girmiyor: model adlari uzun ve OpenRouter'da yaninda
                  10 soruluk tutar da yaziyor. */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Label htmlFor="model">Model</Label>
                  {totalModelCount > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {totalModelCount} model
                    </span>
                  ) : null}
                </div>

                {availableGroups.length > 0 ? (
                  <ModelCombobox
                    id="model"
                    groups={availableGroups}
                    provider={providerId}
                    modelId={modelId}
                    onSelect={changeModel}
                  />
                ) : (
                  <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-mono text-foreground">
                      {modelCatalog.defaultModel || "Tanımlı model yok"}
                    </span>{" "}
                    kullanılacak.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  {modelCatalog.error
                    ? modelCatalog.error
                    : selectedModel?.cost
                      ? `Seçilen model 10 soruda yaklaşık ${selectedModel.cost} tutar. Seçiminiz yalnızca bu üretim için geçerlidir.`
                      : "Sistem yöneticisinin tanımladığı anahtarların eriştiği modeller listelenir. Seçiminiz yalnızca bu üretim için geçerlidir."}
                </p>
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
          // Iskelet de AYNI sayfanin icinde: uretim bitince kutu yerinde
          // kaliyor, yalnizca icerigi degisiyor.
          <div
            className={`exam-paper ${SAYFA_KUTUSU} overflow-hidden rounded-xl border p-4 shadow-sm`}
          >
            <div className="flex gap-3">
              {[0, 1].map((sutun) => (
                <div key={sutun} className="flex min-w-0 flex-1 flex-col gap-3">
                  {Array.from({ length: ISKELET_SAYISI / 2 }, (_, index) => (
                    <Card key={index}>
                      <CardContent className="space-y-3 p-4">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <Card className={`${SAYFA_KUTUSU} border-dashed`}>
            <CardContent className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium">Henuz soru uretilmedi</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Soldaki formu doldurup &quot;Soru üret&quot; butonuna basın.
              </p>
            </CardContent>
          </Card>
        ) : (
          /*
            KENDI ICINDE KAYAN A4 SAYFASI + IKI BAGIMSIZ SUTUN.

            Iki sikayet vardi, ikisi de burada cozuluyor:

            1. "Sorular evrenin sonuna kadar gitmesin, A4 boyutunda bir kutu
               kendi icinde kaysin, alta dogru buyumesin."
               Kutunun olcusu `SAYFA_KUTUSU` sabitinde: SABIT boyda (h-, max-h-
               degil) ve A4 genisliginde. Yirmi soru uretilse de sayfanin boyu
               degismiyor, kaydirma kutunun ICINDE oluyor.

               `overscroll-contain` KRITIK: bunun onceki denemesinde kutunun
               sonuna gelince kaydirma SAYFAYA atliyordu ve "fare tekerlegi
               hangisine gidiyor" karmasasi cikiyordu. Bu ozellik zinciri
               kesiyor - kutu bittiginde sayfa kendiliginden kaymiyor.

            2. "Bosluklu bosluklu, dengesiz siralanmis."
               Sebep CSS grid'in SATIR mantigi: ayni satirdaki en uzun kart
               (grafikli olan) satirin yuksekligini belirliyor, kisa kartin
               altinda bir sonraki satira kadar bos alan kaliyordu.
               `items-start` kartin kendisini germiyordu ama BOSLUGU yok
               etmiyordu - cunku sorun kartta degil, satirda.

               Cozum satir kavramini TUMDEN kaldirmak: iki bagimsiz dikey
               sutun (flex-col). Kartlar tek tek, sirayla soldaki ve sagdaki
               sutuna dagitiliyor; her sutun kendi icinde sikisik paketleniyor
               ve komsu sutunla HIZALANMA ZORUNLULUGU olmuyor. Pinterest'in
               yaptigi is - satir yok, dolayisiyla satir boslugu da yok.

               `min-h` de kaldirildi: artik gerek yok, cunku kartin kisa
               olmasi bir bosluk yaratmiyor. Kart tam icerigi kadar.

            BEYAZ ZEMIN: `.exam-paper` hem SAYFANIN kendisinde hem her
            `<Card>`'ta (cardClassName). Sayfa krem kagit, kartlar onun
            uzerinde bir tik daha beyaz - gercek bir sinav kagidindaki soru
            bloklari gibi. Karttaki tekrar gereksiz gorunebilir ama kart bu
            kutunun DISINDA da kullaniliyor (havuz onayi, revizyon diyalogu);
            oradaki beyaz zemini saglayan sey o.
          */
          <div
            className={`exam-paper ${SAYFA_KUTUSU} overflow-y-auto overscroll-contain rounded-xl border p-4 shadow-sm`}
          >
            <div className="flex gap-3">
              {[0, 1].map((sutun) => (
                <ul key={sutun} className="flex min-w-0 flex-1 flex-col gap-3">
                  {results
                    .map((question, index) => ({ question, index }))
                    .filter(({ index }) => index % 2 === sutun)
                    .map(({ question, index }) => (
                      <li key={`${question.text}-${index}`}>
                        <GeneratedQuestionCard
                          question={question}
                          index={index}
                          selected={selected.has(index)}
                          onToggleSelected={(value) => toggleSelected(index, value)}
                          onReplace={(revised) => replaceResult(index, revised)}
                          cardClassName="exam-paper"
                          {...(kazanim ? { kazanim } : {})}
                          {...(context ? { context } : {})}
                          {...(outcomeId ? { outcomeId } : {})}
                          {...(subject ? { subject } : {})}
                        />
                      </li>
                    ))}
                </ul>
              ))}
            </div>
          </div>
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
