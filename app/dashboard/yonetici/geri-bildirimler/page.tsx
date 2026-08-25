import type { Metadata } from "next";

import { CourseFeedbackReport } from "@/components/shared/course-feedback-report";
import { PageHeader } from "@/components/shared/page-header";
import { getCourseFeedbackSummaries } from "@/lib/queries";

export const metadata: Metadata = { title: "Ders Geri Bildirimleri" };

export default async function YoneticiGeriBildirimleriPage() {
  const summaries = await getCourseFeedbackSummaries();

  return (
    <>
      <PageHeader
        title="Ders Geri Bildirimleri"
        description="Ders ve eğitmen bazında anonim öğrenci deneyimi raporları."
      />
      <CourseFeedbackReport summaries={summaries} showInstructor />
    </>
  );
}
