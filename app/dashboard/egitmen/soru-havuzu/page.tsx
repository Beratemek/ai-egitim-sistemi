import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionPoolBrowser } from "@/components/shared/question-pool-browser";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getExams, getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Egitmenin soru havuzu.
 *
 * Yalnizca ONAYLI sorular gosterilir - taslak inceleme ve onay/red icerik
 * uzmaninin ekranindadir. Egitmen havuzu atolye dali -> konu -> soru olarak
 * gezer, isaretledigi sorulari bir sinava ekler.
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
        description="Havuz atolye dali, konu ve soru olarak kirilir. Dala girin, konuyu acin, sorulari isaretleyip sinaviniza ekleyin."
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Demo — degisiklikler kaydedilmez</Badge>
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
