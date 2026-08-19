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
  MOCK_QUESTIONS,
  MOCK_SCORE_TREND,
  MOCK_STATISTICS,
  MOCK_USERS,
} from "@/lib/mock-data";
import { formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Egitim Yoneticisi" };

export default function YoneticiPage() {
  const totalStudents = MOCK_STATISTICS.reduce(
    (total, row) => total + row.student_count,
    0,
  );
  const totalSubmissions = MOCK_STATISTICS.reduce(
    (total, row) => total + row.submission_count,
    0,
  );
  const totalApproved = MOCK_STATISTICS.reduce(
    (total, row) => total + row.approved_count,
    0,
  );

  const scored = MOCK_STATISTICS.filter((row) => row.average_score !== null);
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
        description="Sinav bazli katilim, ortalama puan ve egitmen onay oranlari."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ogrenci"
          value={totalStudents}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard label="Cevap" value={totalSubmissions} icon={FileText} />
        <StatCard
          label="Genel ortalama"
          value={overallAverage === null ? "-" : Math.round(overallAverage * 10) / 10}
          hint="100 uzerinden"
          icon={Target}
          accent="success"
        />
        <StatCard
          label="Onay orani"
          value={`%${approvalRate}`}
          hint={`${totalApproved} / ${totalSubmissions} cevap onaylandi`}
          icon={CheckCheck}
          accent="warning"
        />
      </div>

      <ScoreTrendChart data={MOCK_SCORE_TREND} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExamAverageChart data={MOCK_STATISTICS} />
        <QuestionStatusChart questions={MOCK_QUESTIONS} />
      </div>

      {/* Grafiklerin tablo karsiligi - ekran okuyucu ve yazdirma icin */}
      <Card>
        <CardHeader>
          <CardTitle>Sinav bazli ozet</CardTitle>
          <CardDescription>
            Kaynak: <code className="font-mono text-xs">public.exam_statistics</code>{" "}
            gorunumu. Yukaridaki grafiklerin sayisal karsiligi.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sinav</TableHead>
                <TableHead className="text-right">Ogrenci</TableHead>
                <TableHead className="text-right">Cevap</TableHead>
                <TableHead className="text-right">Onaylanan</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_STATISTICS.map((row) => (
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
          {MOCK_USERS.map((user) => {
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
