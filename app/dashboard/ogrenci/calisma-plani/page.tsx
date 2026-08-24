import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StudentStudyPlanBoard } from "@/components/shared/student-study-plan-board";

export const metadata: Metadata = { title: "Çalışma Planım" };

export default function OgrenciCalismaPlaniPage() {
  return (
    <>
      <PageHeader
        title="Çalışma Planım"
        description="Gelişim sonuçlarından seçtiğin kazanımları planla, çalışmanı takip et ve tamamla."
      />
      <StudentStudyPlanBoard />
    </>
  );
}
