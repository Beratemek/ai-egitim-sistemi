import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Inbox, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getClassroomExamReviews,
  UNASSIGNED_CLASSROOM,
  type ClassroomExamReview,
} from "@/lib/queries";

export const metadata: Metadata = { title: "Sınav Kontrolü" };

/**
 * Sinav kontrolunun ILK seviyesi: DERSLIKLER.
 *
 * Egitmen bir sinifin isini bir arada bitirmek ister ("Derslik-4'un
 * sinavlarini bir aradan cikarayim"), bu yuzden ust seviye sinav degil
 * SINIFTIR; sinavlar dersligin altinda listelenir.
 *
 * Kutular atamalardan turetilir - sinava atanmamis derslik icin kutu hic
 * olusmaz, boylece "ici bos derslik" gorunmez.
 */
export default async function KontrolPage() {
  const reviews = await getClassroomExamReviews();
  const classrooms = groupByClassroom(reviews);

  const totalPending = reviews.reduce((sum, review) => sum + review.pendingCount, 0);

  return (
    <>
      <PageHeader
        title="Sınav Kontrolü"
        description="Derslik seçin, o dersliğin sınavlarını bütün olarak değerlendirin."
        actions={
          totalPending > 0 ? (
            <Badge variant="warning" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              {totalPending} cevap onay bekliyor
            </Badge>
          ) : null
        }
      />

      {classrooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Kontrol edilecek derslik yok</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Bir sınavı sınıfa atadığınızda ve öğrenciler teslim ettiğinde
                burada derslik kutucukları oluşur.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classrooms.map((classroom) => {
            const href = `/dashboard/egitmen/kontrol/${encodeURIComponent(
              classroom.name,
            )}`;

            const ratio =
              classroom.assignedTotal > 0
                ? Math.round((classroom.submittedTotal / classroom.assignedTotal) * 100)
                : 0;

            const isUnassigned = classroom.name === UNASSIGNED_CLASSROOM;

            return (
              <Link
                key={classroom.name}
                href={href}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span
                          className={cnBadge(isUnassigned)}
                          aria-hidden
                        >
                          <Users className="h-4 w-4" />
                        </span>
                        {classroom.name}
                      </CardTitle>

                      {classroom.pendingCount > 0 ? (
                        <Badge variant="warning">
                          {classroom.pendingCount} bekliyor
                        </Badge>
                      ) : (
                        <Badge variant="success">Tamamlandı</Badge>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {classroom.examCount} sınav
                      {classroom.pendingExamCount > 0
                        ? ` · ${classroom.pendingExamCount} tanesi onay bekliyor`
                        : ""}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Teslim edilen kâğıt</span>
                        <span className="font-medium text-foreground">
                          {classroom.submittedTotal} / {classroom.assignedTotal}
                        </span>
                      </div>
                      <Progress value={ratio} className="mt-1.5 h-1.5" />
                    </div>

                    <div className="flex items-center justify-between border-t pt-3 text-sm">
                      <span className="text-muted-foreground">Derslik ortalaması</span>
                      <span className="font-semibold tabular-nums">
                        {classroom.averageScore === null ? "—" : classroom.averageScore}
                      </span>
                    </div>

                    <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      Sınavlarını aç
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Derslik rozetinin rengi; sinifi atanmamis kova dikkat cekmeli. */
function cnBadge(isUnassigned: boolean): string {
  return isUnassigned
    ? "flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    : "flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary";
}

interface ClassroomSummary {
  name: string;
  examCount: number;
  /** Onay bekleyeni olan sinav sayisi. */
  pendingExamCount: number;
  pendingCount: number;
  assignedTotal: number;
  submittedTotal: number;
  averageScore: number | null;
}

/**
 * (sinif, sinav) satirlarini DERSLIK basina toplar.
 *
 * Ortalama, sinav ortalamalarinin duz ortalamasi degil; her sinavin kendi
 * ortalamasi esit agirlikla alinir - sinavlarin soru sayisi farkli oldugu
 * icin ham puanlari toplamak yaniltici olurdu.
 */
function groupByClassroom(reviews: readonly ClassroomExamReview[]): ClassroomSummary[] {
  const map = new Map<string, ClassroomExamReview[]>();

  for (const review of reviews) {
    const list = map.get(review.classroom) ?? [];
    list.push(review);
    map.set(review.classroom, list);
  }

  return [...map.entries()]
    .map(([name, items]) => {
      const scores = items
        .map((item) => item.averageScore)
        .filter((score): score is number => score !== null);

      return {
        name,
        examCount: items.length,
        pendingExamCount: items.filter((item) => item.pendingCount > 0).length,
        pendingCount: items.reduce((sum, item) => sum + item.pendingCount, 0),
        assignedTotal: items.reduce((sum, item) => sum + item.assignedCount, 0),
        submittedTotal: items.reduce((sum, item) => sum + item.submittedCount, 0),
        averageScore:
          scores.length > 0
            ? Math.round(
                (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
              ) / 10
            : null,
      };
    })
    .sort(
      (a, b) =>
        b.pendingCount - a.pendingCount || a.name.localeCompare(b.name, "tr"),
    );
}
