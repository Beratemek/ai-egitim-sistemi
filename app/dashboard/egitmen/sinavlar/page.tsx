import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CalendarClock,
  Camera,
  FileText,
  Library,
} from "lucide-react";

import { ExamCreateDialog } from "@/components/shared/exam-create-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { getExamSummaries, getSubjectOptions } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Sınavlar" };

/**
 * Eğitmenin sınav listesi.
 * Sınav oluşturma -> soru ekleme -> yayına alma akisinin giriş noktasi.
 */
export default async function SinavlarPage() {
  const [exams, subjectOptions] = await Promise.all([
    getExamSummaries(),
    getSubjectOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Sınavlar"
        description="Havuzdaki onaylı sorulardan sınav seti oluşturun ve yayına alın."
        actions={
          <div className="flex items-center gap-2">
            {isSupabaseConfigured ? null : (
              <Badge variant="warning">Tanıtım modu</Badge>
            )}
            <ExamCreateDialog
              canPersist={isSupabaseConfigured}
              subjectOptions={subjectOptions}
            />
          </div>
        }
      />

      {exams.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Library className="h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium">Henüz sınav oluşturulmadı</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              &ldquo;Yeni sınav&rdquo; ile başlayın; ardından soru havuzundan onaylı
              soruları seçerek sınav setini kurun.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              href={`/dashboard/egitmen/sinavlar/${exam.id}`}
              className="group"
            >
              <Card className="h-full transition-all group-hover:border-primary/50 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="leading-snug">{exam.title}</CardTitle>
                    <Badge variant={exam.is_published ? "success" : "soft"}>
                      {exam.is_published ? "Yayında" : "Taslak"}
                    </Badge>
                  </div>
                  {exam.description ? (
                    <CardDescription>{exam.description}</CardDescription>
                  ) : null}
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {exam.subject ? (
                      <span className="flex items-center gap-1.5">
                        <BookMarked className="h-3.5 w-3.5" />
                        {exam.subject}
                      </span>
                    ) : null}
                    {exam.proctored ? (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                        <Camera className="h-3.5 w-3.5" />
                        Kamera zorunlu
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <Library className="h-3.5 w-3.5" />
                      {exam.questionCount} soru
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {exam.submissionCount} cevap
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/*
                      Once yalnizca baslangic yaziliyordu; tarih verilmemis
                      sinavlar da "Tarih belirlenmedi" diyordu ve bu bir
                      EKSIKLIK gibi okunuyordu. Oysa tarihsiz sinav gecerli
                      bir durum: yayinda oldugu surece acik kalir. Artik
                      pencerenin iki ucu birden ve dogru ifadeyle yaziliyor.
                    */}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                      {examWindowLabel(exam.starts_at, exam.ends_at)}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Sinav penceresini tek satirda anlatir.
 *
 * Tarihsiz sinav bir eksiklik DEGIL: yayinda oldugu surece acik kalir.
 * "Tarih belirlenmedi" ifadesi bunu bir bosluk gibi gosteriyordu.
 */
function examWindowLabel(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return "Tarih sınırı yok";
  if (startsAt && endsAt) {
    return `${formatDateTime(startsAt)} → ${formatDateTime(endsAt)}`;
  }
  if (startsAt) return `${formatDateTime(startsAt)} sonrası`;
  return `${formatDateTime(endsAt)} öncesi`;
}
