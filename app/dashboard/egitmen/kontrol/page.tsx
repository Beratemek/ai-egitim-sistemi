import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookMarked, ClipboardCheck, Inbox, Users } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getClassroomExamReviews } from "@/lib/queries";

export const metadata: Metadata = { title: "Sınav Kontrolü" };

/**
 * Sinif bazli sinav kontrolu.
 *
 * Egitmen tek tek cevap onaylamaz: once bir SINIF + SINAV kutusuna girer,
 * sonra o sinavi butun olarak degerlendirir. Kutular atamalardan turetilir -
 * bir sinava atanmamis sinif icin kutu hic olusmaz.
 */
export default async function KontrolPage() {
  const reviews = await getClassroomExamReviews();

  const totalPending = reviews.reduce((sum, review) => sum + review.pendingCount, 0);

  return (
    <>
      <PageHeader
        title="Sınav Kontrolü"
        description="Sınıfa atanmış sınavları bütün olarak değerlendirin; tek tek cevap aramanız gerekmez."
        actions={
          totalPending > 0 ? (
            <Badge variant="warning" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              {totalPending} cevap onay bekliyor
            </Badge>
          ) : null
        }
      />

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Kontrol edilecek sınav yok</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Bir sınavı sınıfa atadığınızda ve öğrenciler teslim ettiğinde
                burada sınıf bazlı kutucuklar oluşur.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => {
            const href = `/dashboard/egitmen/kontrol/${encodeURIComponent(
              review.classroom,
            )}/${review.exam.id}`;

            const submitRatio =
              review.assignedCount > 0
                ? Math.round((review.submittedCount / review.assignedCount) * 100)
                : 0;

            return (
              <Link
                key={href}
                href={href}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="soft" className="gap-1.5">
                        <Users className="h-3 w-3" />
                        {review.classroom}
                      </Badge>

                      {review.pendingCount > 0 ? (
                        <Badge variant="warning">{review.pendingCount} bekliyor</Badge>
                      ) : (
                        <Badge variant="success">Tamamlandı</Badge>
                      )}
                    </div>

                    <CardTitle className="mt-2 text-base leading-snug">
                      {review.exam.title}
                    </CardTitle>
                    {review.exam.subject ? (
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookMarked className="h-3 w-3" />
                        {review.exam.subject}
                      </span>
                    ) : null}
                    {review.exam.description ? (
                      <CardDescription className="line-clamp-2">
                        {review.exam.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Teslim eden</span>
                        <span className="font-medium text-foreground">
                          {review.submittedCount} / {review.assignedCount}
                        </span>
                      </div>
                      <Progress value={submitRatio} className="mt-1.5 h-1.5" />
                    </div>

                    <div className="flex items-center justify-between border-t pt-3 text-sm">
                      <span className="text-muted-foreground">Sınıf ortalaması</span>
                      <span className="font-semibold tabular-nums">
                        {review.averageScore === null ? "—" : review.averageScore}
                      </span>
                    </div>

                    <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      Sınavı değerlendir
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
