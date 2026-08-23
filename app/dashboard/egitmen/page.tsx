import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Layers,
  Library,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { PageHeader } from "@/components/shared/page-header";
import { OutcomeAnalysis } from "@/components/shared/outcome-analysis";
import { PendingByClassroom } from "@/components/shared/pending-by-classroom";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverEnv } from "@/lib/env";
import {
  getClassroomExamReviews,
  getExams,
  getOutcomeAnalysis,
  getQuestions,
  getSubmissions,
} from "@/lib/queries";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Eğitmen" };

export default async function EgitmenPage() {
  const [questions, exams, submissions, classroomReviews, outcomeAnalysis] =
    await Promise.all([
      getQuestions(),
      getExams(),
      getSubmissions(),
      getClassroomExamReviews(),
      getOutcomeAnalysis(),
    ]);

  // Eğitmen yalnızca havuza dusmus (onaylı) sorularla ilgilenir; taslak
  // inceleme ve onay/red içerik uzmaninin ekranindadir.
  const approved = questions.filter((q) => q.status === "onayli");
  const topicCount = new Set(approved.map((q) => q.topic)).size;
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "ai_degerlendirildi",
  );

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description="Havuzdan sınav oluşturun, öğrenci cevaplarının puanlarını onaylayın."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/egitmen/soru-havuzu"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <Library className="h-4 w-4" />
              Soru havuzu
            </Link>
            <Link
              href="/dashboard/egitmen/sinavlar"
              className={cn(buttonVariants(), "gap-2")}
            >
              <ClipboardList className="h-4 w-4" />
              Sınavlar
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Havuzdaki soru"
          value={approved.length}
          hint="Sınavlarda kullanılabilir"
          icon={Library}
          accent="success"
        />
        <StatCard
          label="Konu"
          value={topicCount}
          hint="Havuzda temsil edilen"
          icon={Layers}
          accent="primary"
        />
        <StatCard label="Sınav" value={exams.length} icon={CalendarClock} />
        <StatCard
          label="Puan onayı bekleyen"
          value={pendingSubmissions.length}
          hint="AI değerlendirdi"
          icon={FileCheck2}
          accent="primary"
        />
      </div>

      {serverEnv.aiMockMode ? <AiMockNotice capability="puanlama" /> : null}

      <PendingByClassroom reviews={classroomReviews} />

      {/*
        SINIFIN OGRENME DURUMU.
        Sartnamenin 2. slaydi "egitmen sinifin ogrenme durumunu tek ekrandan
        gorur" diyor. Sinav ortalamasi bunu vermiyordu: "%61" hangi parcanin
        zayif oldugunu soylemiyor.

        En zayif 5 kazanim gosteriliyor - panel bir ozet ekrani, tam liste
        yonetici raporunda. Her satirda "tekrar sorusu uret" baglantisi var:
        analiz -> uretim -> olcme -> analiz dongusu boylece kapaniyor.
      */}
      <OutcomeAnalysis rows={outcomeAnalysis} canGenerate limit={5} />

      {/* ---------- Sınavlar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Sınavlarım</CardTitle>
          <CardDescription>Oluşturduğunuz sınavlar ve yayın durumları.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{exam.title}</p>
                <Badge variant={exam.is_published ? "success" : "soft"}>
                  {exam.is_published ? "Yayinda" : "Taslak"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{exam.description}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {exam.starts_at ? formatDateTime(exam.starts_at) : "Tarih belirlenmedi"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
