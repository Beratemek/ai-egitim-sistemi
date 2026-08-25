import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StudentMistakesNotebook } from "@/components/shared/student-mistakes-notebook";
import { getStudentMistakeNotebook } from "@/lib/student-mistake-data";

export const metadata: Metadata = { title: "Yanlışlarım Defteri" };

export default async function OgrenciYanlislarimPage() {
  const notebook = await getStudentMistakeNotebook();

  return (
    <>
      <PageHeader
        title="Yanlışlarım Defteri"
        description="Sonuçlanan sınavlarındaki yanlış, eksik ve boş cevapları kazanımlarıyla birlikte incele; çalışma planına taşı veya AI ile benzer bir alıştırma hazırla."
      />
      <StudentMistakesNotebook notebook={notebook} />
    </>
  );
}
