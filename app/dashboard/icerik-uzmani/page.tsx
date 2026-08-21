import type { Metadata } from "next";
import { BookOpen, CircleDashed, Sparkles, ThumbsUp } from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionGeneratorForm } from "@/components/shared/question-generator-form";
import { QuestionPoolTable } from "@/components/shared/question-pool-table";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import { getOutcomes, getPreferenceStats, getQuestions } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "İçerik Uzmanı" };

export default async function IcerikUzmaniPage() {
  const [outcomes, questions, preferenceStats] = await Promise.all([
    getOutcomes(),
    getQuestions(),
    getPreferenceStats(),
  ]);

  // Forma öneri olarak verilir; ayni ders iki farklı yazimla girilmesin.
  const subjects = [...new Set(questions.map((question) => question.subject))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "tr"));

  const aiGenerated = questions.filter((question) => question.ai_generated).length;
  const pending = questions.filter((question) => question.status === "taslak").length;

  return (
    <>
      <PageHeader
        title="İçerik & Kazanımlar"
        description="Kaynak metinleri yükleyin, AI ile soru taslağı üretin, onaylayarak havuza gönderin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kazanim"
          value={outcomes.length}
          icon={BookOpen}
          accent="primary"
        />
        <StatCard
          label="Üretilen soru"
          value={aiGenerated}
          hint="AI kaynaklı"
          icon={Sparkles}
          accent="success"
        />
        <StatCard
          label="Onay bekleyen"
          value={pending}
          hint="Sizin incelemenizde"
          icon={CircleDashed}
          accent="warning"
        />
        <StatCard
          label="Tarz örneği"
          value={preferenceStats.liked + preferenceStats.disliked}
          hint={`${preferenceStats.liked} beğeni · ${preferenceStats.disliked} red`}
          icon={ThumbsUp}
        />
      </div>

      {serverEnv.aiMockMode ? <AiMockNotice capability="uretim" /> : null}

      <QuestionGeneratorForm
        subjects={subjects}
        preferenceStats={preferenceStats}
        canPersist={isSupabaseConfigured}
      />

      {/* ---------- Havuz onayı ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Soru havuzu onayı</CardTitle>
          <CardDescription>
            Onayladiginiz sorular eğitmenin havuzuna düşer ve sınavlarda
            kullanılabilir hale gelir. Reddedilenler havuza girmez.
            {isSupabaseConfigured ? null : " Demo modunda değişiklikler kaydedilmez."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionPoolTable questions={questions} persist={isSupabaseConfigured} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yüklenen kazanımlar</CardTitle>
          <CardDescription>
            {isSupabaseConfigured
              ? "Veritabanındaki kazanımlar."
              : "Demo verisi gösteriliyor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {outcomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground lg:col-span-2">
              Henüz kazanım eklenmemis.
            </p>
          ) : (
            outcomes.map((outcome) => (
              <div key={outcome.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{outcome.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(outcome.created_at)}
                  </p>
                </div>
                <p className="mt-1.5 text-sm">{outcome.outcome_text}</p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {outcome.source_text}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
