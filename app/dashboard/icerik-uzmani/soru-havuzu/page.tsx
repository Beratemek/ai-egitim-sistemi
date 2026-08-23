import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDashed, Library } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionApprovalBoard } from "@/components/shared/question-approval-board";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Soru Havuzu" };

/**
 * İçerik uzmanı - SORU HAVUZU ONAYI.
 *
 * Uretim ekranindan ayri bir sayfa: ikisi ayni sayfadayken 300+ soruluk havuz
 * uretim formunun altinda kaliyordu, uzman onay icin her seferinde sayfanin
 * dibine iniyordu. Uretim bir oturum isi, onay ise ayri bir oturum - ayri
 * ekranlar.
 */
export default async function SoruHavuzuPage() {
  const questions = await getQuestions();

  const pending = questions.filter((question) => question.status === "taslak").length;
  const approved = questions.filter((question) => question.status === "onayli").length;

  return (
    <>
      <PageHeader
        title="Soru Havuzu Onayı"
        description="Soruları ders ve konu başlıkları altında tek tek okuyup onaylayın. Onayladığınız sorular eğitmenin havuzuna düşer; reddedilenler havuza girmez."
        actions={
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard/icerik-uzmani">
              <ArrowLeft className="h-4 w-4" />
              İçerik &amp; Kazanımlar
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3">
        <StatCard
          label="Onay bekleyen"
          value={pending}
          hint="Sizin incelemenizde"
          icon={CircleDashed}
          accent={pending > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Onaylı"
          value={approved}
          hint="Havuzda kullanılabilir"
          icon={CheckCircle2}
          accent="success"
        />
        <StatCard label="Toplam soru" value={questions.length} icon={Library} />
      </div>

      <QuestionApprovalBoard
        questions={questions}
        persist={isSupabaseConfigured}
      />

      {isSupabaseConfigured ? null : (
        <p className="text-xs text-muted-foreground">
          Tanıtım modunda kayıt yapılmaz; kararlarınız sayfa yenilenince sıfırlanır.
        </p>
      )}
    </>
  );
}
