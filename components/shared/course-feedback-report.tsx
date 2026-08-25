import {
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";

import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { courseFeedbackPeriodLabel } from "@/lib/course-feedback";
import type { CourseFeedbackSummary } from "@/lib/queries";

const PRIVACY_THRESHOLD = 3;

export function CourseFeedbackReport({
  summaries,
  showInstructor,
}: {
  summaries: CourseFeedbackSummary[];
  showInstructor: boolean;
}) {
  const totalResponses = summaries.reduce(
    (total, summary) => total + summary.responseCount,
    0,
  );
  const visible = summaries.filter(
    (summary) => summary.overallAverage !== null,
  );
  const weightedAverage =
    visible.length > 0
      ? visible.reduce(
          (total, summary) =>
            total + (summary.overallAverage ?? 0) * summary.responseCount,
          0,
        ) /
        visible.reduce((total, summary) => total + summary.responseCount, 0)
      : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Anonim değerlendirme"
          value={totalResponses}
          hint="gönderim"
          icon={MessageSquareText}
          accent="cat1"
        />
        <StatCard
          label="Raporlanan ders"
          value={visible.length}
          hint={`en az ${PRIVACY_THRESHOLD} yanıt`}
          icon={ShieldCheck}
          accent="cat2"
        />
        <StatCard
          label="Genel deneyim"
          value={weightedAverage === null ? "-" : weightedAverage.toFixed(1)}
          hint="5 üzerinden"
          icon={Star}
          accent="cat3"
        />
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Anonimlik koruması etkin</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Öğrenci adları, hesapları ve tekil kayıtları gösterilmez. Bir ders
              ve dönem için en az {PRIVACY_THRESHOLD} değerlendirme oluşmadan
              puanlar ve yazılı yorumlar açılmaz.
            </p>
          </div>
        </CardContent>
      </Card>

      {summaries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center py-14 text-center">
            <MessageSquareText className="h-9 w-9 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">
              Henüz ders deneyimi değerlendirmesi yok
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Öğrenciler tamamlanan sınavların sonuç kartlarından isteğe bağlı
              değerlendirme gönderdikçe toplu sonuçlar burada oluşacak.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {summaries.map((summary) => (
            <FeedbackSummaryCard
              key={`${summary.instructorId}-${summary.subject}-${summary.academicPeriod}`}
              summary={summary}
              showInstructor={showInstructor}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FeedbackSummaryCard({
  summary,
  showInstructor,
}: {
  summary: CourseFeedbackSummary;
  showInstructor: boolean;
}) {
  const protectedGroup = summary.responseCount < PRIVACY_THRESHOLD;
  const ratings = [
    ["Anlatım", summary.clarityAverage],
    ["Dersin hızı", summary.paceAverage],
    ["Materyaller", summary.materialsAverage],
    ["Ölçme adaleti", summary.assessmentFairnessAverage],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-xl">
              {summary.subject}
            </CardTitle>
            {showInstructor ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {summary.instructorName}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="soft">
              {courseFeedbackPeriodLabel(summary.academicPeriod)}
            </Badge>
            <Badge variant={protectedGroup ? "warning" : "success"}>
              <UsersRound className="mr-1 h-3.5 w-3.5" />
              {summary.responseCount} yanıt
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {protectedGroup ? (
          <div className="flex min-h-[190px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
            <LockKeyhole className="h-7 w-7 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Toplu sonuç henüz açılmadı</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Anonimliği korumak için {PRIVACY_THRESHOLD} değerlendirme gerekli.
              Şu anda {summary.responseCount} değerlendirme bulunuyor.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {ratings.map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold tabular-nums">
                      {value?.toFixed(1)} / 5
                    </span>
                  </div>
                  <Progress value={(value ?? 0) * 20} className="h-2" />
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
              <CommentList
                title="Faydalı bulunanlar"
                comments={summary.helpfulComments}
              />
              <CommentList
                title="Geliştirme önerileri"
                comments={summary.improvementComments}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CommentList({
  title,
  comments,
}: {
  title: string;
  comments: string[];
}) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Yazılı yorum paylaşılmadı.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {comments.slice(0, 6).map((comment, index) => (
            <li
              key={`${index}-${comment}`}
              className="rounded-lg bg-muted/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
            >
              “{comment}”
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
