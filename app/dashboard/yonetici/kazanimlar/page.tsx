import type { Metadata } from "next";
import { AlertTriangle, BookOpenCheck, CircleDashed, Target } from "lucide-react";

import { ManagerOutcomeRiskChart } from "@/components/shared/manager-analytics-charts";
import { ManagerAnalyticsFilter } from "@/components/shared/manager-analytics-filter";
import { ManagerDataQualityNotice } from "@/components/shared/manager-data-quality-notice";
import { ManagerOutcomeHeatmap } from "@/components/shared/manager-outcome-heatmap";
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
import { getManagerAnalytics } from "@/lib/manager-data";
import {
  managerScopeFromSearchParams,
  managerScopeQuery,
  type ManagerAnalyticsSearchParams,
} from "@/lib/manager-filters";

export const metadata: Metadata = { title: "Kazanımlar" };

export default async function ManagerOutcomesPage({
  searchParams,
}: {
  searchParams: Promise<ManagerAnalyticsSearchParams & { durum?: string }>;
}) {
  const params = await searchParams;
  const scope = managerScopeFromSearchParams(params);
  const analytics = await getManagerAnalytics(scope);
  const { durum } = params;
  const measuredCount = analytics.outcomes.filter((outcome) => outcome.averageScore !== null).length;
  const weakCount = analytics.outcomes.filter((outcome) => outcome.isActionableWeak).length;
  const unmeasuredCount = analytics.outcomes.length - measuredCount;
  const pendingCount = analytics.outcomes.reduce((sum, outcome) => sum + outcome.pendingCount, 0);

  return (
    <>
      <PageHeader
        title="Kazanımlar"
        description="Öğrenme çıktılarının hangi ders, sınıf ve öğrencilerde güçlendirilmesi gerektiğini eğitmen onaylı sonuçlarla izleyin."
      />

      <ManagerAnalyticsFilter
        basePath="/dashboard/yonetici/kazanimlar"
        scope={scope}
        options={analytics.filterOptions}
      />

      <ManagerDataQualityNotice overview={analytics.overview} />

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
          hint={`Başarı eşiği %${analytics.masteryThreshold} · destekli kanıt`}
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

      <ManagerOutcomeHeatmap
        outcomes={analytics.outcomes}
        mode="classrooms"
        query={managerScopeQuery(scope)}
      />

      <ManagerOutcomeRiskChart outcomes={analytics.outcomes} />

      <Card>
        <CardHeader>
          <CardTitle>Kazanım tarayıcısı</CardTitle>
          <CardDescription>
            Puanı yalnızca sonuçlanmış sınavlardaki eğitmen onaylı yanıtlar oluşturur; erken sinyaller kesin zayıflık sayılmaz.
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
