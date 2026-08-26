import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  School,
  Target,
  Users,
} from "lucide-react";

import {
  ManagerClassroomChart,
  ManagerScoreTrendChart,
} from "@/components/shared/manager-analytics-charts";
import { ManagerAnalyticsFilter } from "@/components/shared/manager-analytics-filter";
import { ManagerDataQualityNotice } from "@/components/shared/manager-data-quality-notice";
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
import {
  managerScopeFromSearchParams,
  managerScopeQuery,
  type ManagerAnalyticsSearchParams,
} from "@/lib/manager-filters";

export const metadata: Metadata = { title: "Eğitim görünümü" };

export default async function YoneticiPage({
  searchParams,
}: {
  searchParams: Promise<ManagerAnalyticsSearchParams>;
}) {
  const scope = managerScopeFromSearchParams(await searchParams);
  const query = managerScopeQuery(scope);
  const analytics = await getManagerAnalytics(scope);
  const { overview } = analytics;
  const atRiskStudents = analytics.students
    .filter((student) => student.riskLevel === "risk")
    .slice(0, 5);
  const weakOutcomes = analytics.outcomes
    .filter(
      (outcome) =>
        outcome.isActionableWeak,
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Eğitim görünümü"
        description="Sınıfların katılımını, değerlendirme akışını ve öğrenme çıktılarını tek bakışta izleyin."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/yonetici/siniflar${query}`}>
              Sınıfları incele
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      <ManagerAnalyticsFilter
        basePath="/dashboard/yonetici"
        scope={scope}
        options={analytics.filterOptions}
      />

      <ManagerDataQualityNotice overview={analytics.overview} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="İzlenen sınıf"
          value={overview.classroomCount}
          hint={`${overview.studentCount} öğrenci`}
          icon={School}
          accent="cat1"
        />
        <StatCard
          label="Sınav teslim oranı"
          value={`%${overview.completionRate}`}
          hint={`${overview.submittedCount} / ${overview.assignedCount} atama`}
          icon={CheckCircle2}
          accent="cat2"
        />
        <StatCard
          label="Genel ortalama"
          value={overview.averageScore === null ? "—" : overview.averageScore}
          hint="Nihai puanlar · 100 üzerinden"
          icon={GraduationCap}
          accent="cat3"
        />
        <StatCard
          label="Yakın takip"
          value={overview.atRiskStudentCount}
          hint={`${overview.weakOutcomeCount} zayıf kazanım`}
          icon={AlertTriangle}
          accent="cat4"
        />
      </div>

      <section aria-labelledby="attention-title">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 id="attention-title" className="font-display text-lg">
              Bugün dikkat isteyenler
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Önce müdahale gerektiren noktalar; ardından genel görünüm.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <AttentionLink
            href={`/dashboard/yonetici/ogrenciler?durum=risk${query ? `&${query.slice(1)}` : ""}`}
            icon={Users}
            value={overview.atRiskStudentCount}
            label="Müdahale bekleyen öğrenci"
            detail="Eksik teslim, düşük ortalama veya belirgin puan kaybı"
          />
          <AttentionLink
            href={`/dashboard/yonetici/kazanimlar?durum=zayif${query ? `&${query.slice(1)}` : ""}`}
            icon={Target}
            value={overview.weakOutcomeCount}
            label="Güçlendirilmesi gereken kazanım"
            detail={`En az iki soru kanıtıyla başarı eşiği %${analytics.masteryThreshold} altında`}
          />
          <AttentionLink
            href="/dashboard/yonetici/siniflar"
            icon={BookOpenCheck}
            value={overview.pendingReviewCount}
            label="Eğitmen onayı bekleyen cevap"
            detail="AI değerlendirmesi tamamlanmış açık uçlu yanıtlar"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ManagerClassroomChart classrooms={analytics.classrooms} />
        <ManagerScoreTrendChart data={analytics.trend} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Yakın takip listesi</CardTitle>
              <CardDescription>
                En hızlı aksiyon alınması gereken öğrenciler.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/yonetici/ogrenciler${query}`}>Tümünü gör</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {atRiskStudents.length === 0 ? (
              <EmptyState label="Şu anda müdahale gerektiren öğrenci yok." />
            ) : (
              atRiskStudents.map((student) => (
                <Link
                  key={student.studentId}
                  href={`/dashboard/yonetici/ogrenciler/${student.studentId}${query}`}
                  className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {initials(student.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {student.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {student.classroom} · %{student.completionRate} teslim
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <ManagerRiskBadge level={student.riskLevel} />
                  </span>
                  <ManagerScore score={student.averageScore} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Güçlendirilmesi gereken kazanımlar</CardTitle>
              <CardDescription>
                Eğitmen onaylı yanıtlardaki en düşük başarı alanları.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/yonetici/kazanimlar${query}`}>Tümünü gör</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {weakOutcomes.length === 0 ? (
              <EmptyState label="Eşik altında ölçülmüş kazanım yok." />
            ) : (
              weakOutcomes.map((outcome) => (
                <div key={outcome.outcomeId} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium">
                        {outcome.outcomeText}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {outcome.subject} · {outcome.answerCount} onaylı yanıt
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      %{outcome.averageScore}
                    </span>
                  </div>
                  <Progress value={outcome.averageScore ?? 0} className="h-1.5" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Sınav operasyonu</CardTitle>
            <CardDescription>
              Atama, teslim ve değerlendirme akışındaki güncel durum.
            </CardDescription>
          </div>
          <Badge variant="soft">{analytics.exams.length} sınav</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Sınav</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead className="text-right">Atama</TableHead>
                <TableHead className="text-right">Teslim</TableHead>
                <TableHead className="text-right">Sonuçlanan</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
                <TableHead className="text-right">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.exams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Atanmış sınav bulunmuyor.
                  </TableCell>
                </TableRow>
              ) : (
                analytics.exams.slice(0, 8).map((exam) => (
                  <TableRow key={exam.examId}>
                    <TableCell>
                      <p className="font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.subject}</p>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {exam.classrooms.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {exam.assignedCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      %{exam.completionRate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {exam.completedCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <ManagerScore score={exam.averageScore} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={exam.pendingReviewCount > 0 ? "warning" : "success"}>
                        {exam.pendingReviewCount > 0
                          ? `${exam.pendingReviewCount} onay bekliyor`
                          : "Tamam"}
                      </Badge>
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

function AttentionLink({
  href,
  icon: Icon,
  value,
  label,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  value: number;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 items-start gap-3 rounded-xl border bg-card p-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.025]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-2xl tabular-nums">{value}</span>
        <span className="mt-0.5 block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {detail}
        </span>
      </span>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");
}
