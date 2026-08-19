import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionPoolTable } from "@/components/shared/question-pool-table";
import { MOCK_QUESTIONS } from "@/lib/mock-data";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * Soru havuzu.
 *
 * Su an mock veriyle calisiyor. Supabase'e gecerken bu sayfayi soyle degistirin:
 *
 *   const supabase = await createServerSupabaseClient();
 *   const { data: questions } = await supabase
 *     .from("questions")
 *     .select("*")
 *     .order("created_at", { ascending: false });
 *
 * ve `questions ?? []` degerini tabloya gecirin.
 */
export default function SoruHavuzuPage() {
  return (
    <>
      <PageHeader
        title="Soru Havuzu"
        description="AI tarafindan uretilen taslaklari inceleyin; onaylayarak havuza ekleyin."
      />
      <QuestionPoolTable questions={MOCK_QUESTIONS} />
    </>
  );
}
