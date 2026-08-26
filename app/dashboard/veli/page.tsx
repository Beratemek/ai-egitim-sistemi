import type { Metadata } from "next";
import {
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";

import { GuardianStudentCard } from "@/components/shared/guardian-student-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildGuardianHouseholdOverview,
  guardianStudentSummaryView,
} from "@/lib/guardian-analytics";
import { getGuardianStudents } from "@/lib/guardian-data";

export const metadata: Metadata = { title: "Veli takip alanı" };

const scoreFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1,
});

export default async function GuardianDashboardPage() {
  const rows = await getGuardianStudents();
  const overview = buildGuardianHouseholdOverview(rows);
  const students = rows
    .map(guardianStudentSummaryView)
    .sort((a, b) => a.student_name.localeCompare(b.student_name, "tr"));

  return (
    <>
      <PageHeader
        title="Veli takip alanı"
        description="Size atanmış öğrencilerin sınav ilerlemesini ve öğrenme kazanımlarını güvenli, salt okunur bir görünümde takip edin."
      />

      {students.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HeartHandshake className="h-7 w-7" />
            </span>
            <h2 className="mt-5 font-display text-xl">Henüz öğrenci atanmamış</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Bir öğrenciyle bağlantınız sistem yöneticisi tarafından kurulduğunda sınav ve
              kazanım özeti burada otomatik olarak görünecek.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Takip edilen öğrenci"
              value={overview.studentCount}
              hint="Hesabınıza atanmış"
              icon={Users}
              accent="cat1"
            />
            <StatCard
              label="Atanan sınav"
              value={overview.assignedExamCount}
              hint={`${overview.completedExamCount} sınav sonuçlandı`}
              icon={ClipboardList}
              accent="cat2"
            />
            <StatCard
              label="Sonuçlanma"
              value={`%${overview.completionRate}`}
              hint={
                overview.overdueExamCount > 0
                  ? `${overview.overdueExamCount} sınav gecikmiş`
                  : "Geciken sınav yok"
              }
              icon={CheckCircle2}
              accent="cat3"
            />
            <StatCard
              label="Genel ortalama"
              value={
                overview.averageScore === null
                  ? "—"
                  : scoreFormatter.format(overview.averageScore)
              }
              hint="Sonuçlanmış sınavlar · 100 üzerinden"
              icon={Target}
              accent="cat4"
            />
          </div>

          <section aria-labelledby="guardian-students-title">
            <div className="mb-3 flex flex-col gap-1 sm:mb-4">
              <h2 id="guardian-students-title" className="font-display text-lg">
                Öğrencilerim
              </h2>
              <p className="text-xs text-muted-foreground">
                Ayrıntılı gelişim raporunu açmak için bir öğrenci seçin.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {students.map((student) => (
                <GuardianStudentCard key={student.student_id} student={student} />
              ))}
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/15 p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Bu panel soru, doğru cevap, rubrik veya öğrencinin ham yanıtını göstermez;
              yalnızca sonuçlanmış sınavları ve eğitmen onaylı toplu kazanım verilerini
              sunar.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
