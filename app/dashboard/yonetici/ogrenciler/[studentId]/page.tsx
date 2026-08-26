import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Target,
} from "lucide-react";

import { ManagerOutcomeRiskChart } from "@/components/shared/manager-analytics-charts";
import {
  ManagerRiskBadge,
  ManagerScore,
} from "@/components/shared/manager-status";
import { PageHeader } from "@/components/shared/page-header";
import { StudentExamDataDelete } from "@/components/shared/student-exam-data-delete";
import {
  StudentGrowthChart,
  type StudentGrowthPoint,
} from "@/components/shared/student-growth-chart";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getManagerAnalytics } from "@/lib/manager-data";

export const metadata: Metadata = { title: "Öğrenci gelişimi" };

export default async function ManagerStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const analytics = await getManagerAnalytics({ studentId });
  const student = analytics.students[0];

  if (!student) notFound();

  const growthPoints: StudentGrowthPoint[] = student.history
    .filter(
      (item): item is typeof item & { completedAt: string; score: number } =>
        item.completedAt !== null && item.score !== null,
    )
    .map((item) => ({
      attemptId: item.attemptId,
      examId: item.examId,
      title: item.title,
      subject: item.subject,
      completedAt: item.completedAt,
      score: item.score,
    }));
  const measuredOutcomes = analytics.outcomes.filter(
    (outcome) => outcome.averageScore !== null || outcome.pendingCount > 0,
  );

  return (
    <>
      <PageHeader
        title={student.name}
        description={`${student.classroom} · Bireysel sınav, gelişim ve kazanım görünümü.`}
        actions={
          <>
            <ManagerRiskBadge level={student.riskLevel} />
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/yonetici/ogrenciler">
                <ArrowLeft />
                Öğrenciler
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Atanan sınav"
          value={student.assignedCount}
          hint={`${student.submittedCount} sınav teslim edildi`}
          icon={ClipboardList}
          accent="cat1"
        />
        <StatCard
          label="Teslim oranı"
          value={`%${student.completionRate}`}
          hint={student.overdueCount > 0 ? `${student.overdueCount} geciken sınav` : "Geciken sınav yok"}
          icon={CheckCircle2}
          accent="cat2"
        />
        <StatCard
          label="Genel ortalama"
          value={student.averageScore ?? "—"}
          hint={student.scoreChange === null ? "Karşılaştırma için veri bekleniyor" : `Son değişim ${student.scoreChange > 0 ? "+" : ""}${student.scoreChange} puan`}
          icon={Target}
          accent="cat3"
        />
        <StatCard
          label="Zayıf kazanım"
          value={student.weakOutcomeCount}
          hint="Onaylı yanıtlara göre"
          icon={AlertTriangle}
          accent="cat4"
        />
      </div>

      <StudentGrowthChart points={growthPoints} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
        <ManagerOutcomeRiskChart outcomes={analytics.outcomes} />

        <Card>
          <CardHeader>
            <CardTitle>Kazanım karnesi</CardTitle>
            <CardDescription>
              Öğrencinin eğitmen onaylı cevapları ve değerlendirme bekleyen alanları.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {measuredOutcomes.length === 0 ? (
              <div className="flex min-h-56 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                Bu öğrenci için henüz kazanım bazlı sonuç oluşmadı.
              </div>
            ) : (
              measuredOutcomes.slice(0, 7).map((outcome) => (
                <div key={outcome.outcomeId} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium">{outcome.outcomeText}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {outcome.subject} · {outcome.answerCount} onaylı
                        {outcome.pendingCount > 0 ? ` · ${outcome.pendingCount} bekliyor` : ""}
                      </p>
                    </div>
                    <ManagerScore score={outcome.averageScore} />
                  </div>
                  <Progress value={outcome.averageScore ?? 0} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sınav geçmişi</CardTitle>
          <CardDescription>
            Öğrencinin başlattığı sınavlar, güncel durumları ve nihai puanları.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sınav</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">Puan</TableHead>
                {/*
                  Basliksiz sutun: icindeki silme dugmesi zaten kendi
                  aria-label'ini tasiyor, "Islem" yazmak ekran okuyucuya bir
                  sey katmadan tabloyu kalabaliklastirirdi.
                */}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {student.history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                    Henüz başlatılmış sınav bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                [...student.history].reverse().map((result) => (
                  <TableRow key={result.attemptId}>
                    <TableCell>
                      <p className="font-medium">{result.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{result.subject}</p>
                    </TableCell>
                    <TableCell>{attemptStatus(result.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(result.completedAt ?? result.startedAt)}
                    </TableCell>
                    <TableCell className="text-right"><ManagerScore score={result.score} /></TableCell>
                    <TableCell className="text-right">
                      <StudentExamDataDelete
                        examId={result.examId}
                        examTitle={result.title}
                        studentId={student.studentId}
                        studentName={student.name}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function attemptStatus(status: "devam_ediyor" | "degerlendiriliyor" | "sonuclandi") {
  if (status === "sonuclandi") return <Badge variant="success">Sonuçlandı</Badge>;
  if (status === "degerlendiriliyor") return <Badge variant="warning">Değerlendiriliyor</Badge>;
  return <Badge variant="soft">Devam ediyor</Badge>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
