import type { Metadata } from "next";
import { CheckCheck, FileText, GraduationCap, Target } from "lucide-react";

import {
  ExamAverageChart,
  QuestionStatusChart,
  ScoreTrendChart,
} from "@/components/shared/analytics-charts";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getExamStatistics,
  getQuestions,
  getScoreTrend,
  getUsers,
} from "@/lib/queries";
import { formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Eğitim Yöneticisi" };

export default async function YoneticiPage() {
  const [statistics, questions, users, scoreTrend] =
    await Promise.all([
      getExamStatistics(),
      getQuestions(),
      getUsers(),
      getScoreTrend(),
    ]);

  const totalStudents = statistics.reduce(
    (total, row) => total + row.student_count,
    0,
  );
  const totalSubmissions = statistics.reduce(
    (total, row) => total + row.submission_count,
    0,
  );
  const totalApproved = statistics.reduce(
    (total, row) => total + row.approved_count,
    0,
  );

  const scored = statistics.filter((row) => row.average_score !== null);
  const overallAverage =
    scored.length > 0
      ? scored.reduce(
          (total, row) => total + (row.average_score ?? 0) * row.submission_count,
          0,
        ) / scored.reduce((total, row) => total + row.submission_count, 0)
      : null;

  const approvalRate =
    totalSubmissions > 0 ? Math.round((totalApproved / totalSubmissions) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Istatistikler"
        description="Sınav bazlı katılım, ortalama puan ve eğitmen onay oranları."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Öğrenci"
          value={totalStudents}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard label="Cevap" value={totalSubmissions} icon={FileText} />
        <StatCard
          label="Genel ortalama"
          value={overallAverage === null ? "-" : Math.round(overallAverage * 10) / 10}
          hint="100 üzerinden"
          icon={Target}
          accent="success"
        />
        <StatCard
          label="Onay oranı"
          value={`%${approvalRate}`}
          hint={`${totalApproved} / ${totalSubmissions} cevap onaylandı`}
          icon={CheckCheck}
          accent="warning"
        />
      </div>

      <ScoreTrendChart data={scoreTrend} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExamAverageChart data={statistics} />
        <QuestionStatusChart questions={questions} />
      </div>

      {/* Grafiklerin tablo karsiligi - ekran okuyucu ve yazdırma için */}
      <Card>
        <CardHeader>
          <CardTitle>Sınav bazlı özet</CardTitle>
          <CardDescription>
            Kaynak: <code className="font-mono text-xs">public.exam_statistics</code>{" "}
            gorunumu. Yukaridaki grafiklerin sayısal karsiligi.
          </CardDescription>
        </CardHeader>
        {/* Bes sutunlu tablo telefon genisligine sigmaz; yatay kaydirma
            kutunun ICINDE kalmali, sayfanin tamami kaymamali. */}
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sınav</TableHead>
                <TableHead className="text-right">Ogrenci</TableHead>
                <TableHead className="text-right">Cevap</TableHead>
                <TableHead className="text-right">Onaylanan</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((row) => (
                <TableRow key={row.exam_id}>
                  <TableCell className="font-medium">{row.exam_title}</TableCell>
                  <TableCell className="text-right tabular">{row.student_count}</TableCell>
                  <TableCell className="text-right tabular">
                    {row.submission_count}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {row.approved_count}
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {formatScore(row.average_score)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kullanicilar</CardTitle>
          <CardDescription>Sistemdeki roller ve sahipleri.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {users.map((user) => {
            const initials = user.full_name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
              .join("");

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <RoleBadge role={user.role} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
