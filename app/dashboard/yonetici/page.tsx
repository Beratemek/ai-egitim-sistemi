import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { RoleBadge } from "@/components/shared/status-badge";
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
import { MOCK_QUESTIONS, MOCK_STATISTICS, MOCK_USERS } from "@/lib/mock-data";
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

  const weightedScores = MOCK_STATISTICS.filter((row) => row.average_score !== null);
  const overallAverage =
    weightedScores.length > 0
      ? weightedScores.reduce(
          (total, row) => total + (row.average_score ?? 0) * row.submission_count,
          0,
        ) / weightedScores.reduce((total, row) => total + row.submission_count, 0)
      : null;

  const approvalRate =
    totalSubmissions > 0 ? Math.round((totalApproved / totalSubmissions) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Istatistikler"
        description="Sinav bazli katilim, ortalama ve egitmen onay oranlari."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ogrenci" value={totalStudents} />
        <StatCard label="Cevap" value={totalSubmissions} />
        <StatCard
          label="Genel ortalama"
          value={overallAverage === null ? "-" : formatScore(overallAverage)}
        />
        <StatCard
          label="Onay orani"
          value={`%${approvalRate}`}
          hint={`${totalApproved} / ${totalSubmissions} cevap onaylandi`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sinav bazli ozet</CardTitle>
          <CardDescription>
            Kaynak: <code className="font-mono text-xs">public.exam_statistics</code> gorunumu.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableCell className="text-right tabular-nums">
                    {row.student_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.submission_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.approved_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(row.average_score)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Soru havuzu dagilimi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["onayli", "taslak", "reddedildi"] as const).map((status) => {
              const count = MOCK_QUESTIONS.filter((q) => q.status === status).length;
              const percentage =
                MOCK_QUESTIONS.length > 0
                  ? Math.round((count / MOCK_QUESTIONS.length) * 100)
                  : 0;

              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{status}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {count} (%{percentage})
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kullanicilar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOCK_USERS.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <RoleBadge role={user.role} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
