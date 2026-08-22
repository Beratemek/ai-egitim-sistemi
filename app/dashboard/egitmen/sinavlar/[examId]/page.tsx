import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ExamBuilder } from "@/components/shared/exam-builder";
import { ExamClassroomAssign } from "@/components/shared/exam-classroom-assign";
import { ExamSettingsPanel } from "@/components/shared/exam-settings-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getExamAssignedStudentIds,
  getExamDetail,
  getQuestions,
  getSubjectOptions,
  getSubmissions,
  getUsers,
} from "@/lib/queries";

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

  return (
    <>
      <Link
        href="/dashboard/egitmen/sinavlar"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Sınavlar
      </Link>

      <PageHeader
        title={detail.exam.title}
        description={
          detail.exam.description || "Havuzdan soru ekleyip sınavı yayına alın."
        }
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Demo — değişiklikler kaydedilmez</Badge>
          )
        }
      />

      <ExamSettingsPanel
        examId={examId}
        subject={detail.exam.subject}
        durationMinutes={detail.exam.duration_minutes}
        proctored={detail.exam.proctored}
        subjectOptions={subjectOptions}
        questionCount={detail.questions.length}
        totalPoints={detail.questions.reduce((sum, q) => sum + q.points, 0)}
        canPersist={isSupabaseConfigured}
      />

      <ExamClassroomAssign
        examId={examId}
        classrooms={classrooms}
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
  );
}
