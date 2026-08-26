import type { Metadata } from "next";
import { AlertTriangle, BrainCircuit, ChartNoAxesColumnIncreasing, ListChecks } from "lucide-react";

import { InstructorQuestionAnalyticsDashboard } from "@/components/shared/instructor-question-analytics-dashboard";
import { InstructorQuestionFilter } from "@/components/shared/instructor-question-filter";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getInstructorQuestionAnalytics } from "@/lib/instructor-question-data";
import {
  questionAnalyticsScopeFromSearchParams,
  type QuestionAnalyticsSearchParams,
} from "@/lib/question-analytics-filters";

export const metadata: Metadata = { title: "Soru analizi" };

export default async function InstructorQuestionAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<QuestionAnalyticsSearchParams>;
}) {
  const scope = questionAnalyticsScopeFromSearchParams(await searchParams);
  const analytics = await getInstructorQuestionAnalytics(scope);
  const { overview } = analytics;

  return (
    <>
      <PageHeader
        title="Soru analizi"
        description="Sorularınızın başarı, boş bırakma, çeldirici ve değerlendirme tutarlılığını tamamlanmış sınavlardan inceleyin."
      />

      <InstructorQuestionFilter scope={scope} options={analytics.filterOptions} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Ölçülen soru" value={overview.questionCount} hint={`${overview.responseOpportunityCount} yanıtlama fırsatı`} icon={ListChecks} accent="cat1" />
        <StatCard label="Ortalama başarı" value={overview.averageSuccess === null ? "—" : `%${overview.averageSuccess}`} hint="Boşlar dahil · nihai puan" icon={ChartNoAxesColumnIncreasing} accent="cat2" />
        <StatCard label="Öncelikli inceleme" value={overview.highPriorityCount} hint="Zorluk, ayırt edicilik veya puan farkı" icon={AlertTriangle} accent="cat3" />
        <StatCard label="AI–öğretmen farkı" value={overview.averageAiTeacherDifference === null ? "—" : `${overview.averageAiTeacherDifference} puan`} hint={`${overview.insufficientEvidenceCount} soruda veri henüz az`} icon={BrainCircuit} accent="cat4" />
      </div>

      <InstructorQuestionAnalyticsDashboard questions={analytics.questions} />
    </>
  );
}
