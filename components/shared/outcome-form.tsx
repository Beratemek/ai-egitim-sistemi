"use client";

import * as React from "react";
import { ArrowDown, BookPlus, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { createOutcome, type DuplicateOutcome } from "@/app/actions/questions";
import { outcomeSimilarity, BENZERLIK_ESIGI } from "@/lib/outcome-core";
import { subjectKey } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LearningOutcome } from "@/lib/types";

export interface OutcomeFormProps {
  /** Havuzda kullanilan ders adlari; oneri listesi olarak sunulur. */
  subjects?: readonly string[];
  /** Tanimli kazanimlar; tekrar uyarisi ve "bu konuda ne var" listesi icin. */
  outcomes?: readonly LearningOutcome[];
  /** Kazanim kimligi -> o kazanima bagli soru sayisi. */
  usage?: Record<string, number>;
  /** Supabase yoksa kaydetme kapali olur. */
  canPersist: boolean;
}

/**
 * Kazanim tanimlama formu.
 *
 * NEDEN AYRI BIR KAYIT: kazanim, olcmenin hedefi. Havuzdaki her soru bir
 * kazanima baglaniyor (`questions.outcome_id`) ve ogrencinin gelisim ekrani
 * basariyi kazanim bazinda kiriyor. Uretim formuna serbest metin olarak
 * yazilan kazanim yalnizca prompt'a gidiyordu; hicbir soruya baglanmadigi
 * icin kazanim bazli analiz her zaman bos kaliyordu.
 *
 * KAZANIM ENFLASYONUNA KARSI IKI KATMAN:
 *
 *   1. GORUNURLUK - ders + konu yazilir yazilmaz o konudaki mevcut kazanimlar
 *      ve kacar soru topladiklari gorunur. Tekrarlarin cogu kotu niyetten
 *      degil, ne oldugunu bilmemekten dogar; dolu bir kazanimi gormek yeni
 *      yazma ihtiyacini ortadan kaldirir.
 *
 *   2. TEKRAR UYARISI - yazilan metin mevcut bir kazanima cok benziyorsa
 *      kaydetmeden once uyarilir. Uyari BAGLAYICI DEGIL: kelime benzerligi
 *      yanilabilir, karar hocada kalir.
 *
 * Kaynak metin burada OPSIYONEL: kazanim once tanimlanip metin uretim
 * sirasinda yuklenebiliyor. Zorunlu tutmak, ayni metni iki kez girmek
 * anlamina gelirdi.
 */
export function OutcomeForm({
  subjects = [],
  outcomes = [],
  usage = {},
  canPersist,
}: OutcomeFormProps) {
  const [subject, setSubject] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [outcomeText, setOutcomeText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Sunucunun bildirdigi cakisma; "yine de kaydet" secenegini acar. */
  const [duplicate, setDuplicate] = React.useState<DuplicateOutcome | null>(null);

  /* ---------- Katman 1: bu konuda ne var? ---------- */
  const siblings = React.useMemo(() => {
    const dersKey = subject.trim() ? subjectKey(subject) : null;
    const konuKey = topic.trim() ? subjectKey(topic) : null;
    if (!dersKey || !konuKey) return [];

    /*
      Ders esleşmesi aranir, AMA dersi bos olan eski kayitlar da dahil edilir.
      Migration'dan once olusturulan kazanimlarin dersi yok; onlari tumuyle
      dislamak tekrar kontrolunu bu kayitlara karsi KOR ediyordu. Ders bilgisi
      yoksa elimizdeki tek isaret konudur ve onu kullanmak hic
      karsilastirmamaktan iyidir.
    */
    return outcomes.filter(
      (outcome) =>
        subjectKey(outcome.topic) === konuKey &&
        (!outcome.subject || subjectKey(outcome.subject) === dersKey),
    );
  }, [outcomes, subject, topic]);

  /* ---------- Katman 2: yazarken canli tekrar uyarisi ---------- */
  const liveMatch = React.useMemo(() => {
    if (outcomeText.trim().length < 8) return null;

    for (const outcome of siblings) {
      if (outcomeSimilarity(outcomeText, outcome.outcome_text) >= BENZERLIK_ESIGI) {
        return outcome;
      }
    }
    return null;
  }, [outcomeText, siblings]);

  async function submit(force: boolean) {
    setPending(true);
    setError(null);

    const result = await createOutcome({
      subject,
      topic,
      outcomeText,
      ...(force ? { force: true } : {}),
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      setDuplicate(result.duplicate ?? null);
      toast.error("Kazanım kaydedilmedi", { description: result.error });
      return;
    }

    setDuplicate(null);
    toast.success("Kazanım tanımlandı", {
      description: "Artık soru üretiminde bu kazanımı seçebilirsiniz.",
    });

    // Ders korunuyor: uzman genelde ayni derse birkac kazanim girer.
    setTopic("");
    setOutcomeText("");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookPlus className="h-4.5 w-4.5 text-primary" />
          Kazanım tanımla
        </CardTitle>
        <CardDescription>
          Kazanım, ölçmenin hedefidir. Üretilen sorular buna bağlanır ve
          öğrencinin gelişimi kazanım bazında raporlanır.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="outcome-subject">Ders</Label>
              <Input
                id="outcome-subject"
                required
                list="kazanim-ders-onerileri"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Matematik"
              />
              <datalist id="kazanim-ders-onerileri">
                {subjects.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outcome-topic">Konu</Label>
              <Input
                id="outcome-topic"
                required
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Trigonometri"
              />
            </div>
          </div>

          {/* ---------- Katman 1: bu konuda tanimli olanlar ---------- */}
          {siblings.length > 0 ? (
            <div className="rounded-xl border border-warning/40 bg-warning/[0.06] p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
                Bu konuda {siblings.length} kazanım tanımlı
              </p>

              <ul className="mt-2 space-y-1.5">
                {siblings.map((outcome) => (
                  <li
                    key={outcome.id}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <span className="leading-relaxed">{outcome.outcome_text}</span>
                    <Badge variant="soft" className="shrink-0 font-normal">
                      {usage[outcome.id] ?? 0} soru
                    </Badge>
                  </li>
                ))}
              </ul>

              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDown className="h-3.5 w-3.5 shrink-0" />
                Uygun olan varsa yenisini yazmayın — aşağıdaki üretim formunda
                listeden seçebilirsiniz. Aynı kazanımda biriken veri daha
                anlamlı rapor verir.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="outcome-text">Kazanım ifadesi</Label>
            <Textarea
              id="outcome-text"
              required
              rows={2}
              value={outcomeText}
              onChange={(event) => {
                setOutcomeText(event.target.value);
                setDuplicate(null);
                setError(null);
              }}
              placeholder="Öğrenci, birim çember üzerinde trigonometrik oranları hesaplar."
            />
            <p className="text-xs text-muted-foreground">
              Ölçülebilir bir davranış yazın: &quot;açıklar&quot;,
              &quot;hesaplar&quot;, &quot;karşılaştırır&quot; gibi bir fiille
              bitirmek en iyisi.
            </p>
          </div>

          {/* ---------- Katman 2: canli tekrar uyarisi ---------- */}
          {liveMatch && !duplicate ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                Bu, hâlihazırda tanımlı bir kazanımla neredeyse aynı:{" "}
                <strong>{liveMatch.outcome_text}</strong>
                <br />
                İkisini ayrı tutmak o konudaki başarı yüzdesini ikiye böler.
              </span>
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <p className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
              {duplicate ? (
                <>
                  <p className="pl-6 text-xs leading-relaxed">
                    Mevcut kazanım: <strong>{duplicate.outcomeText}</strong>
                  </p>
                  {/*
                    Uyari baglayici degil: kelime benzerligi yanilabilir ve
                    sistemin hocayi kilitlemesi yanlis olur. Ama varsayilan
                    davranis "kaydet" degil - bilincli bir tikla gecilir.
                  */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-6"
                    disabled={pending}
                    onClick={() => void submit(true)}
                  >
                    Farklı bir kazanım, yine de kaydet
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            variant="outline"
            className="w-full gap-2"
            disabled={pending || !canPersist}
            title={canPersist ? undefined : "Tanıtım modunda kayıt yapılmaz"}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookPlus className="h-4 w-4" />
            )}
            Kazanımı kaydet
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
