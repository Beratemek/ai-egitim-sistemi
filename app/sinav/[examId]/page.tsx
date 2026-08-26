import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";

import { ExamCountdown } from "@/components/shared/exam-countdown";
import { ExamFinalizePanel } from "@/components/shared/exam-finalize-panel";
import { ProctoringGate } from "@/components/shared/proctoring-gate";
import { StudentExamQuestions } from "@/components/shared/student-exam-questions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { effectiveDeadline } from "@/lib/exam-time";
import { getStudentExamDetail } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  canAnswerStudentExam,
  getStudentExamStatus,
} from "@/lib/student-exam-status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sınav" };

interface PageProps {
  params: Promise<{ examId: string }>;
}

/**
 * Sinav cozme ekrani - TAM EKRAN.
 *
 * Panel kabugunun disinda duruyor: sol menu, ust cubuk ve kitap raflari
 * sinav sirasinda hem dikkat dagitiyor hem yer caliyordu.
 *
 * Buraya yalnizca sinavi BASLATMIS ogrenci girer. Baslatmamis olan
 * bilgilendirme sayfasina geri gonderilir; sinav orada baslatilir, cunku
 * baslatma geri alinamayan bir karar ve kurallarin okundugu yer orasi.
 */
export default async function SinavCozPage({ params }: PageProps) {
  const { examId } = await params;

  const [detail, current] = await Promise.all([
    getStudentExamDetail(examId),
    getCurrentUser(),
  ]);

  if (!detail || !current) notFound();

  const { exam, questions, submissions, questionCount, attempt } = detail;

  const status = getStudentExamStatus({
    exam,
    questionCount,
    answeredCount: submissions.length,
    evaluatedCount: submissions.filter((s) => s.status !== "gonderildi").length,
    approvedCount: submissions.filter((s) => s.status === "egitmen_onayli").length,
    attemptStatus: attempt?.status,
    attemptStartedAt: attempt?.started_at ?? null,
  });

  // Sinavi baslatmamis ogrencinin burada isi yok.
  if (!attempt) redirect(`/dashboard/ogrenci/sinav/${examId}`);

  // Teslim edilmis ya da suresi dolmus sinav burada acilmaz; sonuc ve
  // durum bilgisi bilgilendirme sayfasinda.
  if (!canAnswerStudentExam(status)) {
    redirect(`/dashboard/ogrenci/sinav/${examId}`);
  }

  const deadline = effectiveDeadline({
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
    startedAt: attempt.started_at,
  });

  const answered = submissions.length;
  const ratio = questionCount > 0 ? Math.round((answered / questionCount) * 100) : 0;

  const govde = (
    <>
      <StudentExamQuestions
        examId={exam.id}
        studentId={current.user.id}
        questions={questions}
        submissions={submissions}
        disabledReason={null}
        revealResults={false}
      />

      <ExamFinalizePanel
        examId={exam.id}
        answeredCount={answered}
        questionCount={questionCount}
      />
    </>
  );

  return (
    <>
      {/*
        Ust serit YAPISKAN: sure ve ilerleme sinav boyunca gorunur kalmali.
        Onceden sayfanin basindaydi ve ogrenci kalan sureyi gormek icin
        yukari kaydirmak zorundaydi.
      */}
      <header className="safe-top sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1560px] px-3 py-2.5 sm:px-8 sm:py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-lg leading-tight">
                {exam.title}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {answered} / {questionCount} soru cevaplandı
              </p>
            </div>

            <div className="flex items-center gap-2">
              {exam.proctored ? (
                <Badge variant="warning" className="gap-1.5">
                  <Camera className="h-3.5 w-3.5" />
                  Kamera açık
                </Badge>
              ) : null}

              {deadline ? (
                <ExamCountdown
                  examId={exam.id}
                  endsAt={deadline.toISOString()}
                  autoSubmit
                />
              ) : null}
            </div>
          </div>

          <Progress value={ratio} className="mt-2.5 h-1" />
        </div>
      </header>

      {/*
        Genis kalip: sinav ekraninda okunacak metin ve 50 dugmelik gezinti
        yan yana duruyor. Dar bir kolona sikistirmak iki yanda koca bosluk
        birakip gezintiyi gereksiz yere uzatiyordu.
      */}
      <main className="mx-auto w-full max-w-[1560px] flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-8 sm:py-5">
        {exam.proctored ? (
          <ProctoringGate examId={exam.id}>{govde}</ProctoringGate>
        ) : (
          govde
        )}
      </main>

      <footer className="safe-bottom border-t">
        <div className="mx-auto w-full max-w-[1560px] px-3 py-2.5 sm:px-8 sm:py-3">
          <Link
            href={`/dashboard/ogrenci/sinav/${examId}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 gap-1.5 text-muted-foreground",
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Sınav bilgilerine dön
          </Link>
        </div>
      </footer>
    </>
  );
}
