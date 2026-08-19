import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
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
  MOCK_EXAMS,
  MOCK_QUESTIONS,
  MOCK_SUBMISSIONS,
  MOCK_USER_NAMES,
} from "@/lib/mock-data";
import { cn, formatDateTime, formatScore } from "@/lib/utils";

export const metadata: Metadata = { title: "Egitmen" };

export default function EgitmenPage() {
  const pendingQuestions = MOCK_QUESTIONS.filter((q) => q.status === "taslak").length;
  const approvedQuestions = MOCK_QUESTIONS.filter((q) => q.status === "onayli").length;
  const pendingSubmissions = MOCK_SUBMISSIONS.filter(
    (submission) => submission.status === "ai_degerlendirildi",
  );

  return (
    <>
      <PageHeader
        title="Genel Bakis"
        description="Onay bekleyen soru taslaklarini ve ogrenci cevaplarini buradan yonetin."
        actions={
          <Link
            href="/dashboard/egitmen/soru-havuzu"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Soru havuzuna git
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Onay bekleyen soru" value={pendingQuestions} />
        <StatCard label="Havuzdaki soru" value={approvedQuestions} hint="Onaylanmis" />
        <StatCard label="Sinav" value={MOCK_EXAMS.length} />
        <StatCard
          label="Puan onayi bekleyen"
          value={pendingSubmissions.length}
          hint="AI degerlendirdi"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Puan onayi bekleyen cevaplar</CardTitle>
          <CardDescription>
            AI on puan verdi; nihai puani siz belirlersiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ogrenci</TableHead>
                <TableHead className="w-[40%]">Cevap ozeti</TableHead>
                <TableHead>AI puani</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_SUBMISSIONS.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    {MOCK_USER_NAMES[submission.student_id] ?? "Bilinmiyor"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="line-clamp-2">{submission.answer_text}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatScore(submission.ai_score)}
                  </TableCell>
                  <TableCell>
                    <SubmissionStatusBadge status={submission.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(submission.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sinavlarim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_EXAMS.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
            >
              <div>
                <p className="font-medium">{exam.title}</p>
                <p className="text-sm text-muted-foreground">{exam.description}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {exam.is_published ? "Yayinda" : "Taslak"} &middot;{" "}
                {formatDateTime(exam.starts_at)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
