import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock3,
  Hourglass,
  LockKeyhole,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { ExamCountdown } from "@/components/shared/exam-countdown";
import { ExamStartPanel } from "@/components/shared/exam-start-panel";
import { PageHeader } from "@/components/shared/page-header";
import { StudentExamQuestions } from "@/components/shared/student-exam-questions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { serverEnv } from "@/lib/env";
import { effectiveDeadline } from "@/lib/exam-time";
import { getStudentExamDetail } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  canAnswerStudentExam,
  getStudentExamStatus,
} from "@/lib/student-exam-status";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Sınav" };

/**
 * Öğrencinin sınav ekrani: sınavdaki tüm sorular sirayla yanitlanir.
 *
 * Sorular `getStudentExamDetail` ile cekilir; bu fonksiyon doğru cevap ve
 * rubriği BILINCLI Olarak getirmez (bkz. lib/queries.ts).
 */
export default async function OgrenciSinavPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const [detail, current] = await Promise.all([
    getStudentExamDetail(examId),
    getCurrentUser(),
  ]);

  if (!detail || !current) notFound();

  const {
    exam,
    questions,
    submissions,
    assignment,
    attempt,
    questionCount,
    totalPoints,
  } = detail;

  // Soru -> öğrencinin cevabı eşleşmesi.
  const answerByQuestion = new Map(
    submissions
      .filter((submission) => submission.question_id !== null)
      .map((submission) => [submission.question_id as string, submission]),
  );

  const answered = questions.filter((question) =>
    answerByQuestion.has(question.id),
  ).length;
  const approved = questions.filter(
    (question) => answerByQuestion.get(question.id)?.status === "egitmen_onayli",
  ).length;
  const evaluated = questions.filter((question) => {
    const submission = answerByQuestion.get(question.id);
    return submission && submission.status !== "gonderildi";
  }).length;
  const status = getStudentExamStatus({
    exam,
    questionCount,
    answeredCount: answered,
    evaluatedCount: evaluated,
    approvedCount: approved,
    attemptStatus: attempt?.status,
    attemptStartedAt: attempt?.started_at ?? null,
  });

  /**
   * Ogrenciyi baglayan etkin bitis: pencere ile kisiye ozel sureden hangisi
   * once biterse o. Sayac ve "Bitis" satiri bunu gosterir, aksi halde
   * ogrenci 2 saatlik pencereyi gorup 40 dakikasi oldugunu bilmezdi.
   */
  const deadline = effectiveDeadline({
    endsAt: exam.ends_at,
    durationMinutes: exam.duration_minutes,
    startedAt: attempt?.started_at ?? null,
  });
  const canAnswer = canAnswerStudentExam(status);
  const lockReason = getLockReason(status, exam.starts_at, exam.ends_at);
  const requiresStart = Boolean(assignment && !attempt && status === "baslanabilir");

  return (
    <>
      <Link
        href="/dashboard/ogrenci"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Sınavlarım
      </Link>

      <PageHeader
        title={exam.title}
        description={exam.description || "Soruları yanıtlayın."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {exam.proctored ? (
              <Badge variant="warning" className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Kamera zorunlu
              </Badge>
            ) : null}
            <ExamStatusBadge status={status} />
          </div>
        }
      />

      {lockReason ? <ExamAvailabilityNotice status={status} message={lockReason} /> : null}

      {attempt?.status === "sonuclandi" ? (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <ResultMetric label="Nihai puan" value={`${attempt.final_score ?? "-"} / 100`} />
            <ResultMetric
              label="Kazanılan puan"
              value={`${attempt.earned_points ?? "-"} / ${attempt.total_points ?? "-"}`}
            />
            <ResultMetric
              label="Aciklanma"
              value={formatDateTime(attempt.completed_at)}
            />
          </CardContent>
        </Card>
      ) : null}

      {serverEnv.aiMockMode && canAnswer && !requiresStart ? (
        <AiMockNotice capability="puanlama" audience="student" />
      ) : null}

      {requiresStart ? (
        <ExamStartPanel
          examId={exam.id}
          questionCount={questionCount}
          totalPoints={totalPoints}
          endsAt={exam.ends_at}
        />
      ) : null}

      {/* ---------- İlerleme ---------- */}
      {!requiresStart ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Ilerleme</span>
              <span className="text-sm font-semibold tabular">
                {answered} / {questionCount} soru
              </span>
            </div>
            <Progress
              value={questionCount > 0 ? (answered / questionCount) * 100 : 0}
              className="h-2"
            />
            {deadline ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Bitiş: {formatDateTime(deadline.toISOString())}
                  {exam.duration_minutes !== null ? (
                    <span className="text-muted-foreground/80">
                      · {exam.duration_minutes} dk süre
                    </span>
                  ) : null}
                </p>
                {attempt?.status === "devam_ediyor" ? (
                  <ExamCountdown
                    examId={exam.id}
                    endsAt={deadline.toISOString()}
                    autoSubmit
                  />
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/*
        Sinav BURADA cozulmuyor.

        Cozme ekrani /sinav/<id> adresinde, panel kabugunun disinda ve tam
        ekran. Bu sayfa sinavin kunyesi: kurallar, sure, durum ve sonuc.
        Sorulari iki yerde birden gostermek, ogrencinin hangi ekranda
        cevap verdiginden emin olamamasi demekti.
      */}
      {canAnswer && !requiresStart ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="min-w-0">
              <p className="font-medium">Sınav devam ediyor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {answered} / {questionCount} soru cevaplandı. Kaldığınız yerden
                devam edebilirsiniz.
              </p>
            </div>

            <Link
              href={`/sinav/${exam.id}`}
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              Sınava devam et
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* ---------- Cevaplar (yalnizca sinav bittikten sonra) ---------- */}
      {!requiresStart && !canAnswer && questions.length > 0 ? (
        <StudentExamQuestions
          examId={exam.id}
          studentId={current.user.id}
          questions={questions}
          submissions={submissions}
          disabledReason={lockReason}
          revealResults={status === "sonuclandi"}
        />
      ) : null}

      {!requiresStart && questions.length === 0 && questionCount > 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Sorular yüklenemedi</p>
            <p className="mx-auto mt-1.5 max-w-sm">
              Bu sınavda {questionCount} soru var ama size gösterilemedi.
              Sayfayı yenileyin; sorun sürerse eğitmeninize bildirin.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function getLockReason(
  status: ReturnType<typeof getStudentExamStatus>,
  startsAt: string | null,
  endsAt: string | null,
): string | null {
  switch (status) {
    case "yaklasan":
      return startsAt
        ? `Bu sınav ${formatDateTime(startsAt)} tarihinde baslayacak. Baslangictan önce cevap veremezsiniz.`
        : "Bu sınav henüz başlamadı.";
    case "suresi_doldu":
      return endsAt
        ? `Bu sınav ${formatDateTime(endsAt)} tarihinde sona erdi. Yeni cevap gonderemezsiniz.`
        : "Bu sınavın cevaplama süresi sona erdi.";
    case "onay_bekliyor":
      return "Tüm cevaplarınız kaydedildi. Sonuçlar eğitmen değerlendirmesinden sonra açıklanacak.";
    case "sonuclandi":
      return "Sınavınız değerlendirildi. Onaylanan sonuçlarınızı aşağıda görebilirsiniz.";
    default:
      return null;
  }
}

function ExamStatusBadge({
  status,
}: {
  status: ReturnType<typeof getStudentExamStatus>;
}) {
  switch (status) {
    case "yaklasan":
      return (
        <Badge variant="soft" className="gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          Yaklaşan
        </Badge>
      );
    case "suresi_doldu":
      return (
        <Badge variant="danger" className="gap-1.5">
          <LockKeyhole className="h-3.5 w-3.5" />
          Süresi doldu
        </Badge>
      );
    case "onay_bekliyor":
      return (
        <Badge variant="warning" className="gap-1.5">
          <Hourglass className="h-3.5 w-3.5" />
          Onay bekliyor
        </Badge>
      );
    case "sonuclandi":
      return (
        <Badge variant="success" className="gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sonuclandi
        </Badge>
      );
    case "devam_ediyor":
      return <Badge variant="warning">Devam ediyor</Badge>;
    case "baslanabilir":
      return <Badge>Baslanabilir</Badge>;
  }
}

function ExamAvailabilityNotice({
  status,
  message,
}: {
  status: ReturnType<typeof getStudentExamStatus>;
  message: string;
}) {
  const isExpired = status === "suresi_doldu";
  const Icon = isExpired ? LockKeyhole : status === "yaklasan" ? Clock3 : Hourglass;

  return (
    <div
      role="status"
      className={
        isExpired
          ? "flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
          : "flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-warning"
      }
    >
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
      <p className="text-sm leading-relaxed">{message}</p>
    </div>
  );
}
