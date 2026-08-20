import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CheckCircle2 } from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { AnswerForm } from "@/components/shared/answer-form";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionTypeBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { serverEnv } from "@/lib/env";
import { getStudentExamDetail } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Sinav" };

/**
 * Ogrencinin sinav ekrani: sinavdaki tum sorular sirayla yanitlanir.
 *
 * Sorular `getStudentExamDetail` ile cekilir; bu fonksiyon dogru cevap ve
 * rubrigi BILINCLI OLARAK getirmez (bkz. lib/queries.ts).
 */
export default async function OgrenciSinavPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const detail = await getStudentExamDetail(examId);

  if (!detail) notFound();

  const { exam, questions, submissions } = detail;

  // Soru -> ogrencinin cevabi eslesmesi.
  const answerByQuestion = new Map(
    submissions
      .filter((submission) => submission.question_id !== null)
      .map((submission) => [submission.question_id as string, submission]),
  );

  const answered = questions.filter((question) =>
    answerByQuestion.has(question.id),
  ).length;
  const isComplete = questions.length > 0 && answered === questions.length;

  return (
    <>
      <Link
        href="/dashboard/ogrenci"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Sinavlarim
      </Link>

      <PageHeader
        title={exam.title}
        description={exam.description || "Sorulari yanitlayin."}
        actions={
          isComplete ? (
            <Badge variant="success" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tamamlandi
            </Badge>
          ) : null
        }
      />

      {serverEnv.aiMockMode ? <AiMockNotice capability="puanlama" /> : null}

      {/* ---------- Ilerleme ---------- */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Ilerleme</span>
            <span className="text-sm font-semibold tabular">
              {answered} / {questions.length} soru
            </span>
          </div>
          <Progress
            value={questions.length > 0 ? (answered / questions.length) * 100 : 0}
            className="h-2"
          />
          {exam.ends_at ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Bitis: {formatDateTime(exam.ends_at)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------- Sorular ---------- */}
      {questions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Bu sinava henuz soru eklenmemis.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <QuestionTypeBadge type={question.type} />
                  <Badge variant="soft">{question.topic}</Badge>
                </div>

                <CardTitle className="mt-2 leading-snug">{question.text}</CardTitle>

                <CardDescription>
                  {question.type === "test"
                    ? "Dogru sikki secip gonderin."
                    : "Cevabiniz rubrige gore degerlendirilecek. Nihai puani egitmen onaylar."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <AnswerForm
                  examId={exam.id}
                  questionId={question.id}
                  type={question.type}
                  options={question.options_json}
                  existing={answerByQuestion.get(question.id) ?? null}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
