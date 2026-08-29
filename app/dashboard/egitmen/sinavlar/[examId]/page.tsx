import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ExamBuilder } from "@/components/shared/exam-builder";
import { ExamClassroomAssign } from "@/components/shared/exam-classroom-assign";
import { ExamDetailTabs } from "@/components/shared/exam-detail-tabs";
import { ExamPaperPanel } from "@/components/shared/exam-paper-panel";
import { ExamQualityPanel } from "@/components/shared/exam-quality-panel";
import { ExamSimulationPanel } from "@/components/shared/exam-simulation-panel";
import { ExamSettingsPanel } from "@/components/shared/exam-settings-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { evaluateExamQuality } from "@/lib/exam-quality";
import {
  getExamAssignedStudentIds,
  getExamDetail,
  getQuestions,
  getSubjectOptions,
  getSubmissions,
  getUsers,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sınav Detayı" };

/**
 * Sınav kurma ekrani.
 * Next.js 15'te `params` asenkrondur; bu yuzden await edilir.
 */
export default async function SinavDetayPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;

  const [detail, pool, submissions, users, assignedIds, subjectOptions] =
    await Promise.all([
      getExamDetail(examId),
      getQuestions({ status: "onayli" }),
      getSubmissions({ examId }),
      getUsers(),
      getExamAssignedStudentIds(examId),
      getSubjectOptions(),
    ]);

  if (!detail) notFound();

  /*
    Sinif ozeti sunucuda hesaplanir: her sinifta kac onayli ogrenci var ve
    kaci bu sinava atanmis. Boylece arayuz "3 / 5 atandi" gibi kismi durumu da
    gosterebiliyor.
  */
  const assigned = new Set(assignedIds);
  const byClassroom = new Map<string, { studentCount: number; assignedCount: number }>();

  for (const user of users) {
    if (user.role !== "ogrenci" || !user.classroom) continue;

    const entry = byClassroom.get(user.classroom) ?? {
      studentCount: 0,
      assignedCount: 0,
    };
    entry.studentCount += 1;
    if (assigned.has(user.id)) entry.assignedCount += 1;
    byClassroom.set(user.classroom, entry);
  }

  const classrooms = [...byClassroom.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  /** Sinava fiilen ogrenci atanmis sinif adlari; kagida on dolgu gecer. */
  const assignedClassrooms = classrooms
    .filter((classroom) => classroom.assignedCount > 0)
    .map((classroom) => classroom.name);

  const totalPoints = detail.questions.reduce((sum, q) => sum + q.points, 0);

  /**
   * Sinavin GERCEK dersleri: sorularindan turetilir.
   *
   * Veritabanindaki `exam_subjects()` ile ayni kural (bkz.
   * uygulandi/2026-08-26-cok-dersli-sinav.sql): bos olmayan, tekillestirilmis
   * ders adlari. Yetki karari orada veriliyor; burada yalnizca ayni kumeyi
   * EKRANDA gostermek icin tekrar hesapliyoruz - sorular zaten yuklu oldugu
   * icin fazladan bir sorgu maliyeti yok.
   *
   * Sinav birden fazla derse ait olabilir; `exams.subject` yalnizca HENUZ
   * SORUSU OLMAYAN sinav icin yedektir.
   */
  const derivedSubjects = Array.from(
    new Set(
      detail.questions
        .map((question) => question.subject?.trim())
        .filter((subject): subject is string => Boolean(subject)),
    ),
  ).sort((a, b) => a.localeCompare(b, "tr"));
  const qualityReport = evaluateExamQuality({
    exam: detail.exam,
    examQuestions: detail.examQuestions,
    questions: detail.questions,
    assignmentCount: assignedIds.length,
  });
  const qualityQuestionNumbers = Object.fromEntries(
    detail.questions.map((question) => [question.id, question.position + 1]),
  );

  return (
    <>
      <Link
        href="/dashboard/egitmen/sinavlar"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 w-fit gap-1.5 text-muted-foreground print:hidden",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Sınavlar
      </Link>

      <PageHeader
        className="print:hidden"
        title={detail.exam.title}
        description={
          detail.exam.description || "Havuzdan soru ekleyip sınavı yayına alın."
        }
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Tanıtım modu</Badge>
          )
        }
      />

      <ExamDetailTabs
        exam={detail.exam}
        questionCount={detail.questions.length}
        totalPoints={totalPoints}
        assignedCount={assignedIds.length}
        qualityCanPublish={qualityReport.canPublish}
        qualityBlockerCount={qualityReport.blockers.length}
        qualityWarningCount={qualityReport.warnings.length}
        canPersist={isSupabaseConfigured}
        kurulum={
          <>
            <ExamSettingsPanel
              examId={examId}
              subject={detail.exam.subject}
              durationMinutes={detail.exam.duration_minutes}
              proctored={detail.exam.proctored}
              startsAt={detail.exam.starts_at}
              endsAt={detail.exam.ends_at}
              subjectOptions={subjectOptions}
              derivedSubjects={derivedSubjects}
              questionCount={detail.questions.length}
              totalPoints={totalPoints}
              pointsAuto={detail.exam.points_auto}
              canPersist={isSupabaseConfigured}
            />

            <ExamBuilder
              exam={detail.exam}
              examQuestions={detail.questions}
              pool={pool}
              hasSubmissions={submissions.length > 0}
              canPersist={isSupabaseConfigured}
            />
          </>
        }
        kalite={
          <ExamQualityPanel
            examId={examId}
            report={qualityReport}
            questionNumbers={qualityQuestionNumbers}
            canPersist={isSupabaseConfigured}
          />
        }
        kestirim={
          <ExamSimulationPanel
            examId={examId}
            classrooms={classrooms}
            subjects={derivedSubjects}
            questionCount={detail.questions.length}
            durationMinutes={detail.exam.duration_minutes}
            canPersist={isSupabaseConfigured}
          />
        }
        siniflar={
          <ExamClassroomAssign
            examId={examId}
            classrooms={classrooms}
            canPersist={isSupabaseConfigured}
          />
        }
        kagit={
          <ExamPaperPanel
            examTitle={detail.exam.title}
            subject={detail.exam.subject}
            durationMinutes={detail.exam.duration_minutes}
            questions={detail.questions}
            classrooms={assignedClassrooms}
          />
        }
      />
    </>
  );
}
