"use client";

import * as React from "react";
import { Download, FileText, Printer } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { numberExamQuestions, toFileName } from "@/lib/exam-paper";
import type { Exam, Question } from "@/lib/types";

/**
 * Sınavın basilabilir A4 kâğıdı ve PDF ciktisi.
 *
 * Çıktı için ayrı bir kutuphane kullanilmaz: tarayicinin kendi yazdırma
 * akisi cagirilir ve hedef olarak "PDF olarak kaydet" secilir. Boylece metin
 * vektorel kalir; html2canvas benzeri cozumler sayfayi goruntuye cevirip
 * kaliteyi dusururdu.
 *
 * Yazdirmada panel kabugu ve bu karttaki denetimler `print:hidden` ile
 * ciktidan çıkar; geriye yalnızca kâğıt kalir (bkz. app/globals.css).
 */

export interface ExamPaperExportProps {
  exam: Exam;
  /** Sınavdaki sorular, `position` sırasında; puanları exam_questions'tan. */
  questions: readonly (Question & { points: number })[];
}

const DEFAULT_INSTRUCTIONS =
  "Çoktan seçmeli sorularda tek doğru şık vardır. Açık uçlu soruları ayrılan boşluğa, okunaklı yazınız.";

export function ExamPaperExport({ exam, questions }: ExamPaperExportProps) {
  const [meta, setMeta] = React.useState<ExamPaperMeta>(() => ({
    title: exam.title,
    school: "",
    lesson: exam.description ?? "",
    grade: "",
    // ISO dizesinin ilk 10 karakteri sunucuda ve tarayicida ayni; yerel saate
    // cevirmek hydration uyusmazligi riski yaratirdi.
    date: exam.starts_at ? exam.starts_at.slice(0, 10) : "",
    duration: durationMinutes(exam.starts_at, exam.ends_at),
    instructions: DEFAULT_INSTRUCTIONS,
  }));

  const [showAnswerKey, setShowAnswerKey] = React.useState(false);

  const paperQuestions = React.useMemo(
    () => numberExamQuestions(questions),
    [questions],
  );

  const totalPoints = paperQuestions.reduce(
    (sum, question) => sum + question.points,
    0,
  );

  const field =
    (key: keyof ExamPaperMeta) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setMeta((current) => ({ ...current, [key]: event.target.value }));

  function handleDownload() {
    // Tarayicinin "PDF olarak kaydet" hedefinde dosya adi sekme basligindan
    // gelir; yazdırma bittiginde eski baslik geri konur.
    const originalTitle = document.title;
    document.title = toFileName(meta.title);

    const restore = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("afterprint", restore);
    window.print();
  }

  if (questions.length === 0) {
    return (
      <Card className="print:hidden">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium">Kagit icin once soru ekleyin</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sınava soru ekledikce basilabilir kâğıt burada oluşur ve PDF olarak
            indirilebilir.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print:border-0 print:shadow-none">
      <CardHeader className="print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sınav kâğıdı</CardTitle>
            <CardDescription>
              {questions.length} soru · {totalPoints} puan · yaprak basina iki
              sütun, sütun basina bes soru.
            </CardDescription>
          </div>

          <Button onClick={handleDownload}>
            <Download />
            PDF olarak indir
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 print:p-0">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          <Field id="paper-school" label="Okul">
            <Input
              id="paper-school"
              value={meta.school}
              onChange={field("school")}
              placeholder="Opsiyonel"
            />
          </Field>

          <Field id="paper-lesson" label="Ders / atölye">
            <Input
              id="paper-lesson"
              value={meta.lesson}
              onChange={field("lesson")}
              placeholder="İleri Robotik"
            />
          </Field>

          <Field id="paper-grade" label="Sinif">
            <Input
              id="paper-grade"
              value={meta.grade}
              onChange={field("grade")}
              placeholder="10-A"
            />
          </Field>

          <Field id="paper-duration" label="Süre (dk)">
            <Input
              id="paper-duration"
              type="number"
              min={5}
              step={5}
              value={meta.duration}
              onChange={field("duration")}
            />
          </Field>

          <Field id="paper-date" label="Tarih">
            <Input
              id="paper-date"
              type="date"
              value={meta.date}
              onChange={field("date")}
            />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field id="paper-instructions" label="Yonerge">
              <Textarea
                id="paper-instructions"
                rows={2}
                value={meta.instructions}
                onChange={field("instructions")}
                className="resize-none text-sm"
              />
            </Field>
          </div>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm print:hidden">
          <Checkbox
            checked={showAnswerKey}
            onChange={(event) => setShowAnswerKey(event.target.checked)}
          />
          Cevap anahtarini ayrı yaprak olarak ekle
        </label>

        <p className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground print:hidden">
          <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="font-medium text-foreground">PDF olarak indir</strong>{" "}
            tarayicinin yazdırma penceresini acar; hedef olarak{" "}
            <em>&quot;PDF olarak kaydet&quot;</em> seçin. Kâğıt boyu A4, kenar
            bosluklari ve sayfa bolme otomatik ayarlidir - olcegi <em>%100</em>{" "}
            bırakın.
          </span>
        </p>

        <ExamPaper
          meta={meta}
          questions={paperQuestions}
          showAnswerKey={showAnswerKey}
        />
      </CardContent>
    </Card>
  );
}

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

/** Başlangıç ve bitiş verilmisse sınav suresini dakika olarak döndürür. */
function durationMinutes(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt || !endsAt) return "40";

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "40";

  return String(Math.round((end - start) / 60_000));
}
