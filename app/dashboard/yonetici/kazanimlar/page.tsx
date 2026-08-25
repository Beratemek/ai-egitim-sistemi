import type { Metadata } from "next";
import { AlertTriangle, BookOpenCheck, CircleDashed, Target } from "lucide-react";

import { ManagerOutcomeRiskChart } from "@/components/shared/manager-analytics-charts";
import { ManagerOutcomeBrowser } from "@/components/shared/manager-outcome-browser";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MANAGER_WEAK_OUTCOME_SCORE } from "@/lib/manager-analytics";
import { getManagerAnalytics } from "@/lib/manager-data";

export const metadata: Metadata = { title: "Kazanımlar" };

export default async function ManagerOutcomesPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  const { durum } = await searchParams;
  const analytics = await getManagerAnalytics();
  const measuredCount = analytics.outcomes.filter((outcome) => outcome.averageScore !== null).length;
  const weakCount = analytics.outcomes.filter(
    (outcome) => outcome.averageScore !== null && outcome.averageScore < MANAGER_WEAK_OUTCOME_SCORE,
  ).length;
  const unmeasuredCount = analytics.outcomes.length - measuredCount;
  const pendingCount = analytics.outcomes.reduce((sum, outcome) => sum + outcome.pendingCount, 0);

  return (
    <>
      <PageHeader
        title="Kazanımlar"
        description="Öğrenme çıktılarının hangi ders, sınıf ve öğrencilerde güçlendirilmesi gerektiğini eğitmen onaylı sonuçlarla izleyin."
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Tanımlı kazanım"
          value={analytics.outcomes.length}
          hint={`${measuredCount} kazanım ölçüldü`}
          icon={Target}
          accent="cat1"
        />
        <StatCard
          label="Güçlendirilmeli"
          value={weakCount}
          hint={`Başarı eşiği %${MANAGER_WEAK_OUTCOME_SCORE}`}
          icon={AlertTriangle}
          accent="cat2"
        />
        <StatCard
          label="Henüz ölçülmedi"
          value={unmeasuredCount}
          hint="Onaylı öğrenci yanıtı oluşmadı"
          icon={CircleDashed}
          accent="cat3"
        />
        <StatCard
          label="Onay bekleyen yanıt"
          value={pendingCount}
          hint="AI değerlendirmesi tamamlandı"
          icon={BookOpenCheck}
          accent="cat4"
        />
      </div>

      <ManagerOutcomeRiskChart outcomes={analytics.outcomes} />

      <Card>
        <CardHeader>
          <CardTitle>Kazanım tarayıcısı</CardTitle>
          <CardDescription>
            Puanı yalnızca eğitmen tarafından onaylanan yanıtlar oluşturur; bekleyen yanıtlar ayrıca gösterilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManagerOutcomeBrowser
            outcomes={analytics.outcomes}
            initialFilter={durum === "zayif" ? "weak" : "all"}
          />
        </CardContent>
      </Card>
    </>
  );
}
