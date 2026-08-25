import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, School, Users } from "lucide-react";

import { ManagerScore } from "@/components/shared/manager-status";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getManagerAnalytics } from "@/lib/manager-data";

export const metadata: Metadata = { title: "Sınıflar" };

export default async function ManagerClassroomsPage() {
  const analytics = await getManagerAnalytics();

  return (
    <>
      <PageHeader
        title="Sınıflar"
        description="Her sınıfın sınav katılımını, sonuçlanma durumunu ve desteğe ihtiyaç duyan öğrencilerini karşılaştırın."
        actions={<Badge variant="soft">{analytics.classrooms.length} sınıf</Badge>}
      />

      {analytics.classrooms.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <School className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">İzlenecek sınıf bulunmuyor</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Öğrencilere sınıf atandığında sınıf görünümü burada otomatik oluşur.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {analytics.classrooms.map((classroom, index) => (
            <Link
              key={classroom.name}
              href={`/dashboard/yonetici/siniflar/${encodeURIComponent(classroom.name)}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="relative h-full overflow-hidden transition-[border-color,background-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:bg-accent/20">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ background: `hsl(var(--book-${(index % 8) + 1}))` }}
                />
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <School className="h-4 w-4" />
                        </span>
                        {classroom.name}
                      </CardTitle>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {classroom.studentCount} öğrenci · {classroom.examCount} sınav
                      </p>
                    </div>
                    {classroom.atRiskStudentCount > 0 ? (
                      <Badge variant="danger">
                        {classroom.atRiskStudentCount} yakın takip
                      </Badge>
                    ) : (
                      <Badge variant="success">Dengeli</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sınıf ortalaması</p>
                      <p className="mt-1 text-sm">
                        <ManagerScore score={classroom.averageScore} />
                      </p>
                    </div>
                    <div className="border-l pl-3">
                      <p className="text-xs text-muted-foreground">Değerlendirilen</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">
                        %{classroom.evaluationRate}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Sınav teslimi</span>
                      <span className="font-medium tabular-nums">
                        {classroom.submittedCount} / {classroom.assignedCount} · %{classroom.completionRate}
                      </span>
                    </div>
                    <Progress value={classroom.completionRate} className="mt-2 h-1.5" />
                  </div>

                  <div className="flex items-center justify-between border-t pt-3 text-xs">
                    <span className={classroom.pendingReviewCount > 0 ? "text-warning" : "text-muted-foreground"}>
                      {classroom.pendingReviewCount > 0
                        ? `${classroom.pendingReviewCount} cevap eğitmen onayında`
                        : "Bekleyen değerlendirme yok"}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      Sınıfı aç
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
