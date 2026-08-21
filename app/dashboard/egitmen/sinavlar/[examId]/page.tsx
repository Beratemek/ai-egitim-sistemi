import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ExamBuilder } from "@/components/shared/exam-builder";
import { ExamPaperExport } from "@/components/shared/exam-paper-export";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/env";
import { getExamDetail, getQuestions, getSubmissions } from "@/lib/queries";

export const metadata: Metadata = { title: "Sinav Detayi" };

/**
 * Sinav kurma ekrani.
 * Next.js 15'te `params` asenkrondur; bu yuzden await edilir.
 */
export default async function SinavDetayPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;

  const [detail, pool, submissions] = await Promise.all([
    getExamDetail(examId),
    getQuestions({ status: "onayli" }),
    getSubmissions({ examId }),
  ]);

  if (!detail) notFound();

  return (
    <>
      <Link
        href="/dashboard/egitmen/sinavlar"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Sinavlar
      </Link>

      <PageHeader
        className="print:hidden"
        title={detail.exam.title}
        description={
          detail.exam.description || "Havuzdan soru ekleyip sinavi yayina alin."
        }
        actions={
          isSupabaseConfigured ? null : (
            <Badge variant="warning">Demo — degisiklikler kaydedilmez</Badge>
          )
        }
      />

      <div className="print:hidden">
        <ExamBuilder
          exam={detail.exam}
          examQuestions={detail.questions}
          pool={pool}
          hasSubmissions={submissions.length > 0}
          canPersist={isSupabaseConfigured}
        />
      </div>

      <ExamPaperExport exam={detail.exam} questions={detail.questions} />
    </>
  );
}
