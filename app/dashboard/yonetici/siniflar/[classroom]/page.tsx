import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Target,
} from "lucide-react";

import {
  ManagerOutcomeRiskChart,
  ManagerScoreTrendChart,
} from "@/components/shared/manager-analytics-charts";
import {
  ManagerRiskBadge,
  ManagerScore,
} from "@/components/shared/manager-status";
import { PageHeader } from "@/components/shared/page-header";
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

export const metadata: Metadata = { title: "Sınıf analizi" };

export default async function ManagerClassroomDetailPage({
  params,
}: {
  params: Promise<{ classroom: string }>;
}) {
  const { classroom: encodedClassroom } = await params;
  const classroomName = decodeURIComponent(encodedClassroom);
  const analytics = await getManagerAnalytics({ classroom: classroomName });
  const classroom = analytics.classrooms.find((item) => item.name === classroomName);

  if (!classroom) notFound();

  return (
    <>
      <PageHeader
        title={classroom.name}
        description="Sınıfın katılım, başarı, kazanım ve öğrenci gelişim görünümü."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/yonetici/siniflar">
              <ArrowLeft />
              Sınıflar
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Öğrenci"
          value={classroom.studentCount}
          hint={`${classroom.examCount} sınavla izleniyor`}
          icon={GraduationCap}
          accent="cat1"
        />
        <StatCard
          label="Teslim oranı"
          value={`%${classroom.completionRate}`}
          hint={`${classroom.submittedCount} / ${classroom.assignedCount} atama`}
          icon={CheckCircle2}
          accent="cat2"
        />
        <StatCard
          label="Sınıf ortalaması"
          value={classroom.averageScore ?? "—"}
          hint="Nihai puanlar · 100 üzerinden"
          icon={Target}
          accent="cat3"
        />
        <StatCard
          label="Yakın takip"
          value={classroom.atRiskStudentCount}
          hint={`${classroom.pendingReviewCount} cevap onay bekliyor`}
          icon={AlertTriangle}
          accent="cat4"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ManagerScoreTrendChart data={analytics.trend} />
        <ManagerOutcomeRiskChart outcomes={analytics.outcomes} />
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Öğrenci görünümü</CardTitle>
            <CardDescription>
              Risk işaretleri; sınav katılımı, başarı ve kazanım verilerinden birlikte üretilir.
            </CardDescription>
          </div>
          <Badge variant="soft">{analytics.students.length} öğrenci</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Öğrenci</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Teslim</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
                <TableHead className="text-right">Değişim</TableHead>
                <TableHead className="text-right">Zayıf kazanım</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.students.map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/yonetici/ogrenciler/${student.studentId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {student.name}
                    </Link>
                    {student.email ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{student.email}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <ManagerRiskBadge level={student.riskLevel} />
                  </TableCell>
                  <TableCell className="min-w-32 text-right">
                    <span className="text-sm font-medium tabular-nums">
                      %{student.completionRate}
                    </span>
                    <Progress value={student.completionRate} className="mt-1.5 ml-auto h-1 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <ManagerScore score={student.averageScore} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {student.scoreChange === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={student.scoreChange < 0 ? "text-destructive" : "text-success"}>
                        {student.scoreChange > 0 ? "+" : ""}{student.scoreChange}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {student.weakOutcomeCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sınav akışı</CardTitle>
          <CardDescription>
            Bu sınıfa yapılan atamalar ve değerlendirme durumu.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sınav</TableHead>
                <TableHead className="text-right">Atama</TableHead>
                <TableHead className="text-right">Teslim</TableHead>
                <TableHead className="text-right">Sonuçlanan</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
                <TableHead className="text-right">Değerlendirme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.exams.map((exam) => (
                <TableRow key={exam.examId}>
                  <TableCell>
                    <p className="font-medium">{exam.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{exam.subject}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{exam.assignedCount}</TableCell>
                  <TableCell className="text-right tabular-nums">%{exam.completionRate}</TableCell>
                  <TableCell className="text-right tabular-nums">{exam.completedCount}</TableCell>
                  <TableCell className="text-right"><ManagerScore score={exam.averageScore} /></TableCell>
                  <TableCell className="text-right">
                    <Badge variant={exam.pendingReviewCount > 0 ? "warning" : "success"}>
                      {exam.pendingReviewCount > 0 ? `${exam.pendingReviewCount} onay bekliyor` : "Tamam"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
