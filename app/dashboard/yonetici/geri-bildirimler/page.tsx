import type { Metadata } from "next";

import { ManagerCourseFeedbackDashboard } from "@/components/shared/manager-course-feedback-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { getCourseFeedbackSummaries } from "@/lib/queries";

export const metadata: Metadata = { title: "Anonim Geri Bildirimler" };

export default async function YoneticiGeriBildirimleriPage() {
  const summaries = await getCourseFeedbackSummaries();

  return (
    <>
      <PageHeader
        title="Anonim Geri Bildirimler"
        description="Ders deneyimini dönem, ders, eğitmen ve değerlendirme boyutlarına göre karşılaştırın; iyileştirme alanlarını öğrenci mahremiyetini koruyarak belirleyin."
      />
      <ManagerCourseFeedbackDashboard summaries={summaries} />
    </>
  );
}
