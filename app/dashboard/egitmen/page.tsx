import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleDashed,
  FileCheck2,
  Library,
  Sparkles,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { SubmissionStatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  getExams,
  getQuestions,
  getSubmissions,
  getUserNameMap,
} from "@/lib/queries";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Egitmen" };

export default async function EgitmenPage() {
  const [questions, exams, submissions, userNames] =
    await Promise.all([
      getQuestions(),
      getExams(),
      getSubmissions(),
      getUserNameMap(),
    ]);

  const pendingQuestions = questions.filter((q) => q.status === "taslak").length;
  const approvedQuestions = questions.filter((q) => q.status === "onayli").length;
  const pendingSubmissions = submissions.filter(
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
            className={cn(buttonVariants(), "gap-2")}
          >
            <Library className="h-4 w-4" />
            Soru havuzu
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Onay bekleyen soru"
          value={pendingQuestions}
          hint="Taslak durumunda"
          icon={CircleDashed}
          accent="warning"
        />
        <StatCard
          label="Havuzdaki soru"
          value={approvedQuestions}
          hint="Sinavlarda kullanilabilir"
          icon={Library}
          accent="success"
        />
        <StatCard label="Sinav" value={exams.length} icon={CalendarClock} />
        <StatCard
          label="Puan onayi bekleyen"
          value={pendingSubmissions.length}
          hint="AI degerlendirdi"
          icon={FileCheck2}
          accent="primary"
        />
      </div>

      {/* ---------- Puan onayi bekleyen cevaplar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
            Puan onayi bekleyen cevaplar
          </CardTitle>
          <CardDescription>
            AI on puan verdi; nihai puani siz belirlersiniz.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {submissions.map((submission) => {
            const studentName = userNames[submission.student_id] ?? "Bilinmiyor";
            const initials = studentName
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0]?.toLocaleUpperCase("tr") ?? "")
              .join("");
            const finalScore =
              submission.instructor_approved_score ?? submission.ai_score ?? 0;
            const isApproved = submission.status === "egitmen_onayli";

            return (
              <div key={submission.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{studentName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(submission.created_at)}
                      </p>
                    </div>
                  </div>

                  <SubmissionStatusBadge status={submission.status} />
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {submission.answer_text}
                </p>

                {submission.ai_feedback ? (
                  <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">AI gerekcesi: </span>
                    {submission.ai_feedback}
                  </p>
                ) : null}

                <Separator className="my-3" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-[180px] flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isApproved ? "Onaylanan puan" : "AI on puani"}
                      </span>
                      <span className="font-semibold tabular">{finalScore} / 100</span>
                    </div>
                    <Progress value={finalScore} className="h-1.5" />
                  </div>

                  {isApproved ? (
                    <Badge variant="success" className="gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Onaylandi
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1.5">
                      Puani incele
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ---------- Sinavlar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Sinavlarim</CardTitle>
          <CardDescription>Olusturdugunuz sinavlar ve yayin durumlari.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="flex flex-col gap-2 rounded-xl border p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{exam.title}</p>
                <Badge variant={exam.is_published ? "success" : "soft"}>
                  {exam.is_published ? "Yayinda" : "Taslak"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{exam.description}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {exam.starts_at ? formatDateTime(exam.starts_at) : "Tarih belirlenmedi"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
