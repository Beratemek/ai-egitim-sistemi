import type { Metadata } from "next";

import { CourseFeedbackReport } from "@/components/shared/course-feedback-report";
import { PageHeader } from "@/components/shared/page-header";
import { getCourseFeedbackSummaries } from "@/lib/queries";

export const metadata: Metadata = { title: "Ders Geri Bildirimleri" };

export default async function EgitmenGeriBildirimleriPage() {
  const summaries = await getCourseFeedbackSummaries();

  return (
    <>
      <PageHeader
        title="Ders Geri Bildirimleri"
        description="Öğrencilerin isteğe bağlı paylaştığı anonim ders deneyimi değerlendirmeleri."
      />
      <CourseFeedbackReport summaries={summaries} showInstructor={false} />
    </>
  );
}
