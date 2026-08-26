import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Camera,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Hourglass,
  ListChecks,
  LockKeyhole,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getStudentExams,
  getStudentResults,
  type StudentExamCard,
} from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase-server";
import {
  getStudentExamStatus,
  type StudentExamStatus,
} from "@/lib/student-exam-status";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Öğrenci" };

type ExamItem = { exam: StudentExamCard; status: StudentExamStatus };
type BadgeVariant = "default" | "soft" | "success" | "warning" | "danger";

const STATUS_META: Record<
  StudentExamStatus,
  { label: string; cta: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  yaklasan: {
    label: "Yaklaşan",
    cta: "Ayrıntıları gör",
    variant: "soft",
    icon: Clock3,
  },
  baslanabilir: {
    label: "Başlanabilir",
    cta: "Hazırlık ekranına geç",
    variant: "default",
    icon: CirclePlay,
  },
  devam_ediyor: {
    label: "Devam ediyor",
    cta: "Devam et",
    variant: "warning",
    icon: CirclePlay,
  },
  suresi_doldu: {
    label: "Süresi doldu",
    cta: "Sınavı incele",
    variant: "danger",
    icon: LockKeyhole,
  },
  onay_bekliyor: {
    label: "Onay bekliyor",
    cta: "Cevapları gör",
    variant: "warning",
    icon: Hourglass,
  },
  sonuclandi: {
    label: "Sonuçlandı",
    cta: "Sonuçları gör",
    variant: "success",
    icon: CheckCircle2,
  },
};

export default async function OgrenciPage() {
  const [exams, results, current] = await Promise.all([
    getStudentExams(),
    getStudentResults(),
    getCurrentUser(),
  ]);

  /**
   * Sinavlar SINIF BAZLI atanir; sinifi olmayan ogrenciye atama yapilamaz.
   * Bu durumda ekran bos kalir - sebebini soylemezsek ogrenci sistemi
   * bozuk saniyor.
   */
  const sinifsiz =
    isSupabaseConfigured &&
    !!current &&
    !(current.profile.classroom ?? "").trim();

  const examItems: ExamItem[] = exams.map((exam) => ({
    exam,
    status: getStudentExamStatus({
      exam,
      questionCount: exam.questionCount,
      answeredCount: exam.answeredCount,
      evaluatedCount: exam.evaluatedCount,
      approvedCount: exam.approvedCount,
      attemptStatus: exam.attempt?.status,
      attemptStartedAt: exam.attempt?.started_at ?? null,
    }),
  }));

  const activeExams = examItems.filter(
    ({ status }) => status === "baslanabilir" || status === "devam_ediyor",
  );
  const upcomingExams = examItems.filter(({ status }) => status === "yaklasan");
  const expiredExams = examItems.filter(
    ({ status }) => status === "suresi_doldu",
  );
  const pendingExams = examItems.filter(
    ({ status }) => status === "onay_bekliyor",
  );

  const pendingExamCount = examItems.filter(
    ({ status }) => status === "onay_bekliyor",
  ).length;
  const completedExamCount = results.length;
  const unseenResultCount = results.filter(
    ({ attempt }) => attempt.result_viewed_at === null,
  ).length;
  const sortedActiveExams = [...activeExams].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "devam_ediyor" ? -1 : 1;
    }

    const aDeadline = a.exam.assignment?.due_at ?? a.exam.ends_at;
    const bDeadline = b.exam.assignment?.due_at ?? b.exam.ends_at;
    const aTime = aDeadline ? new Date(aDeadline).getTime() : Number.POSITIVE_INFINITY;
    const bTime = bDeadline ? new Date(bDeadline).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  const featuredExam = sortedActiveExams[0] ?? null;
  const otherActiveExams = sortedActiveExams.slice(1);
  const rawFirstName = current?.profile.full_name.trim().split(/\s+/)[0] || null;
  const firstName = rawFirstName
    ? `${rawFirstName.charAt(0).toLocaleUpperCase("tr-TR")}${rawFirstName
        .slice(1)
        .toLocaleLowerCase("tr-TR")}`
    : null;
  const examMessage = featuredExam
    ? featuredExam.status === "devam_ediyor"
      ? "Yarım kalan sınavına kaldığın yerden güvenle devam edebilirsin."
      : `${activeExams.length} sınav seni bekliyor. Ayrıntıları kontrol ederek hazır olduğunda başlayabilirsin.`
    : upcomingExams.length > 0
      ? "Şu an açık sınavın yok. Yaklaşan sınavlarını aşağıdan inceleyebilirsin."
      : "Şu an başlaman gereken bir sınav bulunmuyor.";
  const unseenResultMessage =
    unseenResultCount === 1
      ? "1 görüntülenmemiş sonucun var."
      : unseenResultCount > 1
        ? `${unseenResultCount} görüntülenmemiş sonucun var.`
        : null;
  const welcomeDescription = unseenResultMessage
    ? `${unseenResultMessage} ${examMessage}`
    : examMessage;

  return (
    <>
      <PageHeader
        title={firstName ? `Merhaba ${firstName}` : "Sınavlarım"}
        description={welcomeDescription}
      />

      {sinifsiz ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4">
            <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="text-sm font-medium">Sınıfınız henüz atanmadı</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sınavlar sınıflara atanır, bu yüzden size şu an sınav
                görünmüyor. Sistem yöneticisi sınıfınızı atadığında
                sınavlarınız burada listelenir.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}


      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Aktif sınav"
          value={activeExams.length}
          icon={CalendarClock}
          accent="cat1"
        />
        <StatCard
          label="Yaklaşan"
          value={upcomingExams.length}
          hint="sınav"
          icon={Clock3}
          accent="cat2"
        />
        <StatCard
          label="Onay bekleyen"
          value={pendingExamCount}
          hint="sınav"
          icon={Hourglass}
          accent="cat3"
        />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl">Sıradaki sınav</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Önce bu sınavın ayrıntılarını ve hazırlık koşullarını kontrol et.
          </p>
        </div>

        {featuredExam ? (
          <FeaturedExamCard item={featuredExam} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[170px] flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary/60" />
              <p className="mt-3 text-sm font-medium">
                Şu an başlaman gereken sınav yok.
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Yeni bir sınav atandığında veya sınav zamanı geldiğinde burada
                öne çıkarılacak.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <div
        className={cn(
          "grid gap-6",
          (pendingExams.length > 0 || completedExamCount > 0) &&
            "lg:grid-cols-5",
        )}
      >
        <div
          className={cn(
            "space-y-7",
            (pendingExams.length > 0 || completedExamCount > 0) &&
              "lg:col-span-3",
          )}
        >
          {otherActiveExams.length > 0 ? (
            <ExamSection title="Diğer açık sınavlar" items={otherActiveExams} />
          ) : null}

          {upcomingExams.length > 0 ? (
            <ExamSection title="Yaklaşan sınavlar" items={upcomingExams} />
          ) : null}

          {expiredExams.length > 0 ? (
            <ExamSection title="Süresi dolan sınavlar" items={expiredExams} />
          ) : null}
        </div>

        {pendingExams.length > 0 || completedExamCount > 0 ? (
          <div className="space-y-3 lg:col-span-2">
            {pendingExams.length > 0 ? (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Değerlendirmedeki sınavlar
                </h2>
                {pendingExams.map(({ exam, status }) => (
                  <StudentExamCardView
                    key={exam.id}
                    exam={exam}
                    status={status}
                  />
                ))}
              </>
            ) : null}

            {completedExamCount > 0 ? (
              <Link
                href="/dashboard/ogrenci/sonuclar"
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                  unseenResultCount > 0
                    ? "border-stat-4/40 bg-stat-4/[0.08] hover:border-stat-4/70"
                    : "bg-card hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <span className="flex items-center gap-2">
                  {unseenResultCount > 0 ? (
                    <BellRing className="h-4 w-4 shrink-0 text-stat-4" />
                  ) : null}
                  {unseenResultCount > 0
                    ? unseenResultMessage
                    : `${completedExamCount} açıklanmış sonucu Sonuçlarım ekranında gör`}
                </span>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function FeaturedExamCard({ item }: { item: ExamItem }) {
  const { exam, status } = item;
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const href =
    status === "devam_ediyor"
      ? `/sinav/${exam.id}`
      : `/dashboard/ogrenci/sinav/${exam.id}`;
  const deadline = exam.assignment?.due_at ?? exam.ends_at;
  const progress =
    exam.questionCount > 0 ? (exam.answeredCount / exam.questionCount) * 100 : 0;

  return (
    <Link href={href} className="group block">
      <Card className="overflow-hidden border-stat-1/30 bg-stat-1/[0.06] transition-all group-hover:border-primary/50 group-hover:shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge variant={meta.variant} className="gap-1.5">
                <StatusIcon className="h-3.5 w-3.5" />
                {meta.label}
              </Badge>
              <h3 className="mt-3 font-display text-2xl leading-tight sm:text-3xl">
                {exam.title}
              </h3>
              {exam.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {exam.description}
                </p>
              ) : null}
            </div>

            <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform group-hover:translate-x-0.5">
              {status === "devam_ediyor" ? "Sınava devam et" : "Hazırlığı kontrol et"}
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-stat-1/20 py-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-stat-1" />
              {exam.questionCount} soru
            </span>
            <span className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-stat-1" />
              {exam.duration_minutes
                ? `${exam.duration_minutes} dakika`
                : "Süre sınırı yok"}
            </span>
            {exam.proctored ? (
              <span className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-stat-1" />
                Kamera ve mikrofon gerekli
              </span>
            ) : null}
            {deadline ? (
              <span className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-stat-1" />
                Son teslim: {formatDateTime(deadline)}
              </span>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {status === "devam_ediyor" ? "Sınav ilerlemen" : "Henüz başlamadın"}
              </span>
              <span className="font-semibold tabular-nums">
                {exam.answeredCount} / {exam.questionCount}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ExamSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ExamItem[];
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>

      {items.length === 0 ? (
        emptyMessage ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground min-h-[240px]">
              {emptyMessage}
            </CardContent>
          </Card>
        ) : null
      ) : (
        items.map(({ exam, status }) => (
          <StudentExamCardView key={exam.id} exam={exam} status={status} />
        ))
      )}
    </section>
  );
}

function StudentExamCardView({
  exam,
  status,
}: {
  exam: StudentExamCard;
  status: StudentExamStatus;
}) {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const href =
    status === "devam_ediyor"
      ? `/sinav/${exam.id}`
      : `/dashboard/ogrenci/sinav/${exam.id}`;
  const dateLabel =
    status === "yaklasan" && exam.starts_at
      ? `Başlangıç: ${formatDateTime(exam.starts_at)}`
      : exam.ends_at
        ? `${status === "suresi_doldu" ? "Sona erdi" : "Bitiş"}: ${formatDateTime(exam.ends_at)}`
        : "Süre sınırı yok";

  return (
    <Link
      href={href}
      className="group block"
    >
      <Card className="transition-all group-hover:border-primary/50 group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="leading-snug">{exam.title}</CardTitle>
            <Badge variant={meta.variant} className="gap-1.5">
              <StatusIcon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
          </div>
          {exam.description ? (
            <CardDescription>{exam.description}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Yanıtlanan</span>
              <span className="font-semibold tabular">
                {exam.answeredCount} / {exam.questionCount}
              </span>
            </div>
            <Progress
              value={
                exam.questionCount > 0
                  ? (exam.answeredCount / exam.questionCount) * 100
                  : 0
              }
              className="h-1.5"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              {meta.cta}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
