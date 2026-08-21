import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  FileCheck2,
  Layers,
  Library,
  Sparkles,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubmissionReviewDialog } from "@/components/shared/submission-review-dialog";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import {
  getExams,
  getQuestions,
  getSubmissions,
  getUserNameMap,
} from "@/lib/queries";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Eğitmen" };

export default async function EgitmenPage() {
  const [questions, exams, submissions, userNames] =
    await Promise.all([
      getQuestions(),
      getExams(),
      getSubmissions(),
      getUserNameMap(),
    ]);

  // Cevap -> soru metni eşleşmesi: onay diyalogunda soruyu da gosterebilmek için.
  const questionTextById = new Map(questions.map((q) => [q.id, q.text]));

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* ---------- Puan onayı bekleyen cevaplar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
            Puan onayı bekleyen cevaplar
          </CardTitle>
          <CardDescription>
            AI on puan verdi; nihai puanı siz belirlersiniz.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {submissions.map((submission) => {
            const studentName = userNames[submission.student_id] ?? "Bilinmiyor";
            const initials = studentName
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
              .join("");
            const finalScore =
              submission.instructor_approved_score ?? submission.ai_score ?? 0;
            const isApproved = submission.status === "egitmen_onayli";

            return (
              <div key={submission.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(submission.created_at)}
                      </p>
                    </div>
                  </div>

                  <SubmissionStatusBadge status={submission.status} />
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {submission.answer_text}
                </p>

                {submission.ai_feedback ? (
                  <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">AI gerekcesi: </span>
                    {submission.ai_feedback}
                  </p>
                ) : null}

                <Separator className="my-3" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isApproved ? "Onaylanan puan" : "AI on puanı"}
                      </span>
                      <span className="font-semibold tabular">{finalScore} / 100</span>
                    </div>
                    <Progress value={finalScore} className="h-1.5" />
                  </div>

                  {isApproved ? (
                    <Badge variant="success" className="gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Onaylandı
                    </Badge>
                  ) : (
                    <SubmissionReviewDialog
                      submission={submission}
                      studentName={studentName}
                      canPersist={isSupabaseConfigured}
                      {...(submission.question_id &&
                      questionTextById.has(submission.question_id)
                        ? {
                            questionText: questionTextById.get(
                              submission.question_id,
                            ) as string,
                          }
                        : {})}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
