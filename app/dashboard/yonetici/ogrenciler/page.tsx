import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";

import {
  ManagerRiskBadge,
  ManagerScore,
} from "@/components/shared/manager-status";
import { PageHeader } from "@/components/shared/page-header";
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
import type { ManagerRiskLevel } from "@/lib/manager-analytics";
import { getManagerAnalytics } from "@/lib/manager-data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Öğrenciler" };

const FILTERS: Array<{ value: "all" | ManagerRiskLevel; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "risk", label: "Müdahale gerekli" },
  { value: "watch", label: "Yakından izle" },
  { value: "good", label: "İyi ilerliyor" },
  { value: "unmeasured", label: "Ölçülmedi" },
];

export default async function ManagerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;
  const activeFilter = isRiskLevel(durum) ? durum : "all";
  const analytics = await getManagerAnalytics();
  const students =
    activeFilter === "all"
      ? analytics.students
      : analytics.students.filter((student) => student.riskLevel === activeFilter);

  return (
    <>
      <PageHeader
        title="Öğrenciler"
        description="Sınav katılımı, puan hareketi ve kazanım performansını öğrenci bazında izleyin."
        actions={<Badge variant="soft">{analytics.students.length} öğrenci</Badge>}
      />

      <div className="flex flex-wrap gap-2" aria-label="Öğrenci durum filtresi">
        {FILTERS.map((filter) => {
          const active = filter.value === activeFilter;
          const href =
            filter.value === "all"
              ? "/dashboard/yonetici/ogrenciler"
              : `/dashboard/yonetici/ogrenciler?durum=${filter.value}`;
          return (
            <Button
              key={filter.value}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              <Link href={href} aria-current={active ? "page" : undefined}>
                {filter.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                >
                  {filter.value === "all"
                    ? analytics.students.length
                    : analytics.students.filter((student) => student.riskLevel === filter.value).length}
                </span>
              </Link>
            </Button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gelişim ve erken uyarı listesi</CardTitle>
          <CardDescription>
            Risk durumu eksik teslim, nihai puan, puan değişimi ve zayıf kazanımları birlikte değerlendirir.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Öğrenci</TableHead>
                <TableHead>Sınıf</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Teslim</TableHead>
                <TableHead className="text-right">Ortalama</TableHead>
                <TableHead className="text-right">Son değişim</TableHead>
                <TableHead className="text-right">Kazanım</TableHead>
                <TableHead aria-label="Detay" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <p className="mt-3 font-medium">Bu durumda öğrenci yok</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Farklı bir filtre seçerek listeyi genişletebilirsiniz.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell>
                      <Link
                        href={`/dashboard/yonetici/ogrenciler/${student.studentId}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {student.name}
                      </Link>
                      {student.email ? (
                        <p className="mt-0.5 max-w-52 truncate text-xs text-muted-foreground">
                          {student.email}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{student.classroom}</TableCell>
                    <TableCell><ManagerRiskBadge level={student.riskLevel} /></TableCell>
                    <TableCell className="min-w-32 text-right">
                      <span className="text-sm font-medium tabular-nums">
                        %{student.completionRate}
                      </span>
                      <Progress value={student.completionRate} className="mt-1.5 ml-auto h-1 w-24" />
                    </TableCell>
                    <TableCell className="text-right"><ManagerScore score={student.averageScore} /></TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {student.scoreChange === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={student.scoreChange < 0 ? "text-destructive" : "text-success"}>
                          {student.scoreChange > 0 ? "+" : ""}{student.scoreChange} puan
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {student.weakOutcomeCount > 0 ? (
                        <Badge variant="warning">{student.weakOutcomeCount} zayıf</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          href={`/dashboard/yonetici/ogrenciler/${student.studentId}`}
                          aria-label={`${student.name} gelişimini aç`}
                        >
                          <ArrowRight />
                        </Link>
                      </Button>
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

function isRiskLevel(value: string | undefined): value is ManagerRiskLevel {
  return value === "risk" || value === "watch" || value === "good" || value === "unmeasured";
}
