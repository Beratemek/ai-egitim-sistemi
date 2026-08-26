import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionPoolBrowser } from "@/components/shared/question-pool-browser";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Eğitmenin soru havuzu.
 *
 * Yalnızca Onaylı sorular gösterilir - taslak inceleme ve onay/red içerik
 * uzmaninin ekranindadir. Eğitmen havuzu ders -> konu -> soru olarak
 * gezer, isaretledigi sorulardan yeni bir sınav kurar. Var olan bir sınava
 * soru eklemek o sınavın kendi düzenleme ekranında yapılır.
 */
export default async function SoruHavuzuPage() {
  const questions = await getQuestions({ status: "onayli" });

  return (
    <>
      <PageHeader
        title="Soru Havuzu"
        description="Havuz ders, konu ve soru olarak kırılır. Derse girin, konuyu açın, soruları işaretleyip yeni bir sınav kurun."
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Tanıtım modu</Badge>
          )
        }
      />

      <QuestionPoolBrowser questions={questions} canPersist={isSupabaseConfigured} />
    </>
  );
}
