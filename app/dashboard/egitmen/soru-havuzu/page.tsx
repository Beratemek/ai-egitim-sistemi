import type { Metadata } from "next";

import { ExamWorkbench } from "@/components/shared/exam-workbench";
import { isSupabaseConfigured } from "@/lib/env";
import { getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Egitmenin soru havuzu.
 *
 * Yalnizca ONAYLI sorular gosterilir - taslak inceleme ve onay/red icerik
 * uzmaninin ekranindadir. Egitmen buradan konu bazli secim yapip sinav
 * kagidi uretir.
 */
export default async function SoruHavuzuPage() {
  const questions = await getQuestions({ status: "onayli" });

  return <ExamWorkbench questions={questions} canPersist={isSupabaseConfigured} />;
}
