import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Inbox,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getClassroomExamReviews, UNASSIGNED_CLASSROOM } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Derslik Sınavları" };

interface PageProps {
  params: Promise<{ classroom: string }>;
}

/**
 * Bir dersligin TUM sinavlari.
 *
 * Egitmen bir sinifin isini bir arada bitirmek ister; bu sayfa o dersligin
 * calisma alani. Onay bekleyen sinavlar basa alinir ki once is olan yere
 * bakilsin.
 */
export default async function DerslikPage({ params }: PageProps) {
  const { classroom: raw } = await params;
  const classroom = decodeURIComponent(raw);

  const all = await getClassroomExamReviews();
  const reviews = all.filter((review) => review.classroom === classroom);

  if (reviews.length === 0) notFound();

  const pendingCount = reviews.reduce((sum, review) => sum + review.pendingCount, 0);
  const isUnassigned = classroom === UNASSIGNED_CLASSROOM;

  return (
    <>
      <Link
        href="/dashboard/egitmen/kontrol"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 gap-1.5 text-muted-foreground",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Derslikler
      </Link>

      <PageHeader
        title={classroom}
        description={`Bu dersliğe atanmış ${reviews.length} sınav. Değerlendirmek istediğiniz sınavı seçin.`}
        actions={
          pendingCount > 0 ? (
            <Badge variant="warning" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              {pendingCount} cevap onay bekliyor
            </Badge>
          ) : (
            <Badge variant="success">Tüm cevaplar onaylı</Badge>
          )
        }
      />

      {isUnassigned ? (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          <Users className="mr-1.5 inline h-3.5 w-3.5" />
          Bu öğrencilere henüz sınıf atanmamış. Sistem yöneticisi sınıf
          atadığında kendi derslik kutularına taşınırlar.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reviews.map((review) => {
          const href = `/dashboard/egitmen/kontrol/${encodeURIComponent(
            classroom,
          )}/${review.exam.id}`;

          const ratio =
            review.assignedCount > 0
              ? Math.round((review.submittedCount / review.assignedCount) * 100)
              : 0;

          return (
            <Link
              key={review.exam.id}
              href={href}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {review.exam.title}
                    </CardTitle>

                    {review.pendingCount > 0 ? (
                      <Badge variant="warning" className="shrink-0">
                        {review.pendingCount} bekliyor
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0">
                        Onaylı
                      </Badge>
                    )}
                  </div>

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
                    <Progress value={ratio} className="mt-1.5 h-1.5" />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Sınav ortalaması</span>
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
    </>
  );
}
