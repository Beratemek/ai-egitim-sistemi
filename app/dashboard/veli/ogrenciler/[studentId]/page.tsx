import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Send,
  Target,
} from "lucide-react";

import { GuardianExamStatusTable } from "@/components/shared/guardian-exam-status-table";
import { GuardianOutcomeReport } from "@/components/shared/guardian-outcome-report";
import { PageHeader } from "@/components/shared/page-header";
import {
  StudentGrowthChart,
  type StudentGrowthPoint,
} from "@/components/shared/student-growth-chart";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  buildGuardianStudentAnalytics,
  GUARDIAN_MASTERY_THRESHOLD,
} from "@/lib/guardian-analytics";
import { getGuardianStudentDetail } from "@/lib/guardian-data";

export const metadata: Metadata = { title: "Öğrenci takip raporu" };

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export default async function GuardianStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const detail = await getGuardianStudentDetail(studentId);

  if (!detail) notFound();

  const analytics = buildGuardianStudentAnalytics(
    detail.student,
    detail.exams,
    detail.outcomes,
    { masteryThreshold: GUARDIAN_MASTERY_THRESHOLD },
  );
  const growthPoints: StudentGrowthPoint[] = analytics.growthPoints;

  return (
    <>
      <PageHeader
        title={analytics.student.student_name}
        description={`${analytics.student.classroom || "Sınıf atanmamış"} · Sınav ilerlemesi ve eğitmen onaylı kazanım görünümü.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/veli">
              <ArrowLeft />
              Öğrencilerim
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Atanan sınav"
          value={analytics.assignedCount}
          hint={analytics.overdueCount > 0 ? `${analytics.overdueCount} geciken` : "Geciken yok"}
          icon={ClipboardList}
          accent="cat1"
        />
        <StatCard
          label="Teslim"
          value={analytics.submittedCount}
          hint={`${analytics.submittedCount} / ${analytics.assignedCount} sınav`}
          icon={Send}
          accent="cat2"
        />
        <StatCard
          label="Sonuçlanma"
          value={`%${analytics.completionRate}`}
          hint={`${analytics.completedCount} sınav sonuçlandı`}
          icon={CheckCircle2}
          accent="cat3"
        />
        <StatCard
          label="Genel ortalama"
          value={
            analytics.averageScore === null
              ? "—"
              : scoreFormatter.format(analytics.averageScore)
          }
          hint="Nihai puanlar · 100 üzerinden"
          icon={Target}
          accent="cat4"
        />
        <StatCard
          label="Destek alanı"
          value={analytics.supportAreaCount}
          hint={
            analytics.earlySignalCount > 0
              ? `${analytics.earlySignalCount} ek erken sinyal`
              : "Yeterli kanıta göre"
          }
          icon={AlertTriangle}
          accent={analytics.supportAreaCount > 0 ? "warning" : "success"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <StudentGrowthChart points={growthPoints} />

      <GuardianExamStatusTable exams={analytics.exams} />

      <GuardianOutcomeReport
        outcomes={analytics.outcomes}
        masteryThreshold={GUARDIAN_MASTERY_THRESHOLD}
      />
    </>
  );
}
