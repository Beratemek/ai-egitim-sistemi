"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Inbox, Users } from "lucide-react";

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
import type { ClassroomExamReview } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Puanlanmayi bekleyen sinavlar - SINIF bazli.
 *
 * Onceki surumde burada duz bir "onay bekleyen cevaplar" listesi vardi: butun
 * siniflarin cevaplari tek torbada, hangi sinifin hangi sinavina ait oldugu
 * belirsiz. Her sinifin kendine ozgu sinavi olabildigi icin dogru gruplama
 * SINIF; egitmen bir sinifin sinavini butun olarak degerlendirir.
 *
 * Kutulara tiklanınca sinif+sinav degerlendirme ekrani acilir; puan onayi
 * orada, sinavin butunu gorunurken verilir.
 */

export interface PendingByClassroomProps {
  reviews: readonly ClassroomExamReview[];
}

export function PendingByClassroom({ reviews }: PendingByClassroomProps) {
  // Yalnizca isi olan kutular: onay bekleyeni olmayan sinav burada yer kaplamaz.
  const pending = reviews.filter((review) => review.pendingCount > 0);

  const byClassroom = React.useMemo(() => {
    const map = new Map<string, ClassroomExamReview[]>();
    for (const review of pending) {
      const list = map.get(review.classroom) ?? [];
      list.push(review);
      map.set(review.classroom, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [pending]);

  const total = pending.reduce((sum, review) => sum + review.pendingCount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4.5 w-4.5 text-primary" />
              Puanlanmayı bekleyen sınavlar
            </CardTitle>
            <CardDescription>
              Sınıfına göre ayrıldı. Bir sınavı bütün olarak değerlendirmek için
              kutusuna girin.
            </CardDescription>
          </div>

          {total > 0 ? (
            <Badge variant="warning" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              {total} cevap
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {byClassroom.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">Puan onayı bekleyen sınav yok</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Öğrenciler sınav teslim ettiğinde ve AI ön puanını verdiğinde
                sınıf kutuları burada belirir.
              </p>
            </div>
            <Link
              href="/dashboard/egitmen/kontrol"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              Tüm sınav kontrolü
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {byClassroom.map(([classroom, items]) => {
              const classroomPending = items.reduce(
                (sum, review) => sum + review.pendingCount,
                0,
              );

              return (
                <section key={classroom} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Link
                      href={`/dashboard/egitmen/kontrol/${encodeURIComponent(classroom)}`}
                      className="text-sm font-semibold hover:text-primary hover:underline"
                    >
                      {classroom}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {classroomPending} cevap · {items.length} sınav
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {items.map((review) => {
                      const href = `/dashboard/egitmen/kontrol/${encodeURIComponent(
                        review.classroom,
                      )}/${review.exam.id}`;

                      const ratio =
                        review.assignedCount > 0
                          ? Math.round(
                              (review.submittedCount / review.assignedCount) * 100,
                            )
                          : 0;

                      return (
                        <Link
                          key={href}
                          href={href}
                          className="group rounded-xl border p-3.5 transition-colors hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
                              {review.exam.title}
                            </p>
                            <Badge variant="warning" className="shrink-0">
                              {review.pendingCount}
                            </Badge>
                          </div>

                          {review.exam.subject ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {review.exam.subject}
                            </p>
                          ) : null}

                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Teslim eden</span>
                              <span className="font-medium text-foreground">
                                {review.submittedCount} / {review.assignedCount}
                              </span>
                            </div>
                            <Progress value={ratio} className="h-1.5" />
                          </div>

                          <span className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
                            Sınavı değerlendir
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
