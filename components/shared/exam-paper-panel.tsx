"use client";

import * as React from "react";
import { Info, Printer } from "lucide-react";

import { ExamPaper, type ExamPaperMeta } from "@/components/shared/exam-paper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONS_PER_PAGE, toFileName, withNumbers } from "@/lib/exam-paper";
import type { Question } from "@/lib/types";

/**
 * Kayitli bir sinavin BASILABILIR kagidi.
 *
 * Sol menu "PDF indir" diye bir yetenek soz veriyordu ama o yetenek hicbir
 * sayfaya bagli degildi: kagit uretimi `exam-workbench.tsx` icinde, havuzdan
 * gecici bir sinav derleyen ve artik hicbir yerden acilmayan bir ekranda
 * kalmisti. Burada AYNI kagit, sinavin KENDI verisine baglandi.
 *
 * Onemli fark: puanlar yeniden dagitilmiyor. Havuzdan derlenen gecici kagit
 * 100 puani sorulara paylastiriyordu; kayitli sinavin puanlari ise
 * `exam_questions` tablosunda zaten belli ve ogrencinin ekraninda gordugu
 * degerle basili kagit AYNI olmak zorunda (bkz. `withNumbers`).
 */

const DEFAULT_INSTRUCTIONS =
  "Çoktan seçmeli sorularda tek doğru şık vardır. Açık uçlu soruları ayrılan boşluğa, okunaklı yazınız.";

export interface ExamPaperPanelProps {
  /** Sinav basligi; kagidin ust bilgisine on dolgu olarak gecer. */
  examTitle: string;
  subject: string | null;
  durationMinutes: number | null;
  /** Sinavin sorulari, `position` sirasinda ve KENDI puanlariyla. */
  questions: readonly (Question & { points: number })[];
  /** Sinavin atandigi sinif adlari; tek sinif varsa kagida on dolgu gecer. */
  classrooms?: readonly string[];
}

export function ExamPaperPanel({
  examTitle,
  subject,
  durationMinutes,
  questions,
  classrooms = [],
}: ExamPaperPanelProps) {
  const [showAnswerKey, setShowAnswerKey] = React.useState(false);

  const [meta, setMeta] = React.useState<ExamPaperMeta>({
    title: examTitle,
    school: "",
    lesson: subject ?? "",
    // Tek sinifa atanmissa o sinif; birden fazlaysa egitmen kendisi yazar
    // (ayni kagit iki sinifa da gidebilir, yanlis sinif basmak istemeyiz).
    grade: classrooms.length === 1 ? (classrooms[0] ?? "") : "",
    date: "",
    duration: durationMinutes === null ? "" : String(durationMinutes),
    instructions: DEFAULT_INSTRUCTIONS,
  });

  /*
    Tarih SUNUCUDA degil tarayicida hesaplanir: sunucunun saat dilimi
    kullanicininkinden farkli olabilir ve SSR ciktisi ile ilk cizim
    ayrisirsa hydration uyusmazligi olusur.
  */
  React.useEffect(() => {
    setMeta((current) => (current.date ? current : { ...current, date: todayIso() }));
  }, []);

  // Sinavin adi/dersi/suresi ayarlardan degistirilebiliyor; egitmen elle bir
  // sey yazmadiysa kagit o degisikligi takip etmeli.
  React.useEffect(() => {
    setMeta((current) => ({
      ...current,
      title: current.title === "" ? examTitle : current.title,
      lesson: current.lesson === "" ? (subject ?? "") : current.lesson,
    }));
  }, [examTitle, subject]);

  const paperQuestions = React.useMemo(() => withNumbers(questions), [questions]);

  const totalPoints = paperQuestions.reduce((sum, item) => sum + item.points, 0);
  const sheetCount =
    Math.ceil(paperQuestions.length / QUESTIONS_PER_PAGE) +
    (showAnswerKey ? 1 : 0);

  function handlePrint() {
    /*
      Tarayicinin "PDF olarak kaydet" hedefinde dosya adi SEKME BASLIGINDAN
      gelir; bu yuzden yazdirma suresince baslik sinavin adi yapilir ve
      is bitince geri konur.
    */
    const originalTitle = document.title;
    document.title = toFileName(meta.title, "sinav");

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
  }

  if (questions.length === 0) {
    return (
      <Card className="border-dashed print:hidden">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Printer className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">Basılacak soru yok</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            &ldquo;Kurulum&rdquo; sekmesinden havuzdaki onaylı sorulardan
            ekleyin; kağıt burada kendiliğinden oluşur.
          </p>
        </CardContent>
      </Card>
    );
  }

  const field =
    (key: keyof ExamPaperMeta) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setMeta((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] print:block print:gap-0">
      {/* ---------- Kagit ---------- */}
      <div className="min-w-0 space-y-3 print:space-y-0">
        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground print:hidden">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-medium text-foreground">Yazdır / PDF</strong>{" "}
            tarayıcının yazdırma penceresini açar; hedef olarak{" "}
            <em>&ldquo;PDF olarak kaydet&rdquo;</em> seçin. Kağıt boyu A4, kenar
            boşlukları ve sayfa bölme hazır ayarlıdır &mdash; ölçeği{" "}
            <em>%100</em> bırakın.
          </span>
        </p>

        <ExamPaper
          meta={meta}
          questions={paperQuestions}
          showAnswerKey={showAnswerKey}
        />
      </div>

      {/* ---------- Kagit ust bilgisi ---------- */}
      <Card className="lg:sticky lg:top-20 lg:self-start print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kağıt üst bilgisi</CardTitle>
          <CardDescription>
            Yalnızca çıktıyı biçimlendirir; sınavın kendi ayarlarına dokunmaz.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Field id="kagit-baslik" label="Başlık">
            <Input id="kagit-baslik" value={meta.title} onChange={field("title")} />
          </Field>

          <Field id="kagit-okul" label="Okul / kurum">
            <Input
              id="kagit-okul"
              value={meta.school}
              onChange={field("school")}
              placeholder="İsteğe bağlı"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="kagit-ders" label="Ders">
              <Input id="kagit-ders" value={meta.lesson} onChange={field("lesson")} />
            </Field>

            <Field id="kagit-sinif" label="Sınıf">
              <Input
                id="kagit-sinif"
                value={meta.grade}
                onChange={field("grade")}
                placeholder="10-A"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="kagit-tarih" label="Tarih">
              <Input
                id="kagit-tarih"
                type="date"
                value={meta.date}
                onChange={field("date")}
              />
            </Field>

            <Field id="kagit-sure" label="Süre (dk)">
              <Input
                id="kagit-sure"
                type="number"
                min={1}
                value={meta.duration}
                onChange={field("duration")}
              />
            </Field>
          </div>

          <Field id="kagit-yonerge" label="Yönerge">
            <Textarea
              id="kagit-yonerge"
              rows={3}
              value={meta.instructions}
              onChange={field("instructions")}
              className="resize-none text-sm"
            />
          </Field>

          <Separator />

          <dl className="space-y-1.5 text-sm">
            <SummaryRow label="Soru" value={`${paperQuestions.length} soru`} />
            <SummaryRow label="Toplam puan" value={`${totalPoints} puan`} />
            <SummaryRow label="Kâğıt" value={`${sheetCount} yaprak`} />
          </dl>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={showAnswerKey}
              onChange={(event) => setShowAnswerKey(event.target.checked)}
            />
            Cevap anahtarını ekle
          </label>

          <Button className="w-full gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Yazdır / PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Yerel saat diliminde bugunun yyyy-aa-gg karsiligi. */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
