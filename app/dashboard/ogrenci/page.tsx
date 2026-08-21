import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Hourglass,
  LockKeyhole,
  Trophy,
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
import {
  getStudentExams,
  getSubmissions,
  type StudentExamCard,
} from "@/lib/queries";
import {
  getStudentExamStatus,
  type StudentExamStatus,
} from "@/lib/student-exam-status";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Öğrenci" };

type ExamItem = { exam: StudentExamCard; status: StudentExamStatus };
type BadgeVariant = "default" | "soft" | "success" | "warning" | "danger";

const STATUS_META: Record<
  StudentExamStatus,
  { label: string; cta: string; variant: BadgeVariant; icon: LucideIcon }
> = {
  yaklasan: {
    label: "Yaklasan",
    cta: "Ayrıntıları gör",
    variant: "soft",
    icon: Clock3,
  },
  baslanabilir: {
    label: "Baslanabilir",
    cta: "Sınava başla",
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
    label: "Sonuclandi",
    cta: "Sonuçları gör",
    variant: "success",
    icon: CheckCircle2,
  },
};

export default async function OgrenciPage() {
  const [exams, submissions] = await Promise.all([
    getStudentExams(),
    getSubmissions(),
  ]);

  const examItems: ExamItem[] = exams.map((exam) => ({
    exam,
    status: getStudentExamStatus({
      exam,
      questionCount: exam.questionCount,
      answeredCount: exam.answeredCount,
      evaluatedCount: exam.evaluatedCount,
      approvedCount: exam.approvedCount,
      attemptStatus: exam.attempt?.status,
    }),
  }));

  const activeExams = examItems.filter(
    ({ status }) => status === "baslanabilir" || status === "devam_ediyor",
  );
  const upcomingExams = examItems.filter(({ status }) => status === "yaklasan");
  const expiredExams = examItems.filter(
    ({ exam, status }) => status === "suresi_doldu" && exam.answeredCount === 0,
  );
  const examHistory = examItems.filter(({ exam }) => exam.answeredCount > 0);

  const pendingExamCount = examItems.filter(
    ({ status }) => status === "onay_bekliyor",
  ).length;
  const completedExamCount = examItems.filter(
    ({ status }) => status === "sonuclandi",
  ).length;

  return (
    <>
      <PageHeader
        title="Sinavlarim"
        description="Açık sınavlara katılın; sonuçlarınızı eğitmen onayından sonra görün."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Aktif sınav"
          value={activeExams.length}
          icon={CalendarClock}
          accent="primary"
        />
        <StatCard
          label="Onay bekleyen"
          value={pendingExamCount}
          hint="sinav"
          icon={Hourglass}
        />
        <StatCard
          label="Sonuclanan"
          value={completedExamCount}
          hint="sinav"
          icon={Trophy}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-7 lg:col-span-3">
          <ExamSection
            title="Girebileceğiniz sınavlar"
            items={activeExams}
            emptyMessage="Su an cevaplamaya açık sınav yok."
          />

          {upcomingExams.length > 0 ? (
            <ExamSection title="Yaklaşan sınavlar" items={upcomingExams} />
          ) : null}

          {expiredExams.length > 0 ? (
            <ExamSection title="Süresi dolan sınavlar" items={expiredExams} />
          ) : null}
        </div>

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sınav gecmisim
          </h2>

          {examHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Henüz basladiginiz bir sınav yok.
              </CardContent>
            </Card>
          ) : (
            examHistory.map(({ exam, status }) => (
              <ExamHistoryCard
                key={exam.id}
                exam={exam}
                status={status}
                submissions={submissions.filter(
                  (submission) => submission.exam_id === exam.id,
                )}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ExamHistoryCard({
  exam,
  status,
  submissions,
}: {
  exam: StudentExamCard;
  status: StudentExamStatus;
  submissions: Awaited<ReturnType<typeof getSubmissions>>;
}) {
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const score =
    status === "sonuclandi"
      ? exam.attempt?.final_score ?? null
      : null;
  const latest = submissions
    .map((submission) => submission.updated_at)
    .sort((a, b) => b.localeCompare(a))[0];
  const message =
    status === "sonuclandi"
      ? "Eğitmen onaylı sonucunuz açıklandı."
      : status === "onay_bekliyor"
        ? "Cevaplarınız değerlendirmede; sonuç eğitmen onayından sonra açıklanacak."
        : status === "suresi_doldu"
          ? "Sınav süresi sona erdi. Kayıtlı cevaplarınızı inceleyebilirsiniz."
          : "Cevaplarınız taslak olarak kayıtlı; sınavı bitirene kadar düzenleyebilirsiniz.";

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold leading-snug">{exam.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {exam.answeredCount} / {exam.questionCount} cevap kaydedildi
            </p>
          </div>
          <Badge variant={meta.variant} className="shrink-0 gap-1.5">
            <StatusIcon className="h-3.5 w-3.5" />
            {meta.label}
          </Badge>
        </div>

        <Progress
          value={
            exam.questionCount > 0
              ? (exam.answeredCount / exam.questionCount) * 100
              : 0
          }
          className="h-1.5"
        />

        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>

        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {latest ? formatDateTime(latest) : "-"}
          </span>
          <Link
            href={`/dashboard/ogrenci/sinav/${exam.id}`}
            className="flex items-center gap-1 font-medium text-primary"
          >
            {score === null ? meta.cta : `${score} / 100`}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
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
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
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
  const dateLabel =
    status === "yaklasan" && exam.starts_at
      ? `Başlangıç: ${formatDateTime(exam.starts_at)}`
      : exam.ends_at
        ? `${status === "suresi_doldu" ? "Sona erdi" : "Bitis"}: ${formatDateTime(exam.ends_at)}`
        : "Süre sınırı yok";

  return (
    <Link
      href={`/dashboard/ogrenci/sinav/${exam.id}`}
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
              <span className="text-muted-foreground">Yanitlanan</span>
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
