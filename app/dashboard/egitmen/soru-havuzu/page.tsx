import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionPoolTable } from "@/components/shared/question-pool-table";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Soru havuzu. Veriler `lib/queries.ts` uzerinden gelir; Supabase
 * yapilandirilmamissa demo verisine duser ve onay/red kalici olmaz.
 */
export default async function SoruHavuzuPage() {
  const questions = await getQuestions();

  return (
    <>
      <PageHeader
        title="Soru Havuzu"
        description="AI tarafindan uretilen taslaklari inceleyin; onaylayarak havuza ekleyin."
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Demo — degisiklikler kaydedilmez</Badge>
          )
        }
      />
      <QuestionPoolTable questions={questions} persist={isSupabaseConfigured} />
    </>
  );
}
