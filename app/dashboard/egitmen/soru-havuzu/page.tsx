import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionPoolBrowser } from "@/components/shared/question-pool-browser";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getExams, getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Eğitmenin soru havuzu.
 *
 * Yalnızca Onaylı sorular gösterilir - taslak inceleme ve onay/red içerik
 * uzmaninin ekranindadir. Eğitmen havuzu atölye dalı -> konu -> soru olarak
 * gezer, isaretledigi soruları bir sınava ekler.
 */
export default async function SoruHavuzuPage() {
  const [questions, exams] = await Promise.all([
    getQuestions({ status: "onayli" }),
    getExams(),
  ]);

  return (
    <>
      <PageHeader
        title="Soru Havuzu"
        description="Havuz ders, konu ve soru olarak kırılır. Derse girin, konuyu açın, soruları işaretleyip sınavınıza ekleyin."
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Tanıtım modu</Badge>
          )
        }
      />

      <QuestionPoolBrowser
        questions={questions}
        exams={exams}
        canPersist={isSupabaseConfigured}
      />
    </>
  );
}
