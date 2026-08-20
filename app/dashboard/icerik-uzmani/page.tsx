import type { Metadata } from "next";
import { BookOpen, CircleDashed, Sparkles, ThumbsUp } from "lucide-react";

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
import { isSupabaseConfigured } from "@/lib/env";
import { getOutcomes, getPreferenceStats, getQuestions } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Icerik Uzmani" };

export default async function IcerikUzmaniPage() {
  const [outcomes, questions, preferenceStats] = await Promise.all([
    getOutcomes(),
    getQuestions(),
    getPreferenceStats(),
  ]);

  // Forma oneri olarak verilir; ayni ders iki farkli yazimla girilmesin.
  const subjects = [...new Set(questions.map((question) => question.subject))].sort(
    (a, b) => a.localeCompare(b, "tr"),
  );

  const aiGenerated = questions.filter((question) => question.ai_generated).length;
  const pending = questions.filter((question) => question.status === "taslak").length;

  return (
    <>
      <PageHeader
        title="Icerik & Kazanimlar"
        description="Kaynak metinleri yukleyin, AI ile soru taslagi uretin, onaylayarak havuza gonderin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kazanim"
          value={outcomes.length}
          icon={BookOpen}
          accent="primary"
        />
        <StatCard
          label="Uretilen soru"
          value={aiGenerated}
          hint="AI kaynakli"
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
          label="Tarz ornegi"
          value={preferenceStats.liked + preferenceStats.disliked}
          hint={`${preferenceStats.liked} begeni · ${preferenceStats.disliked} red`}
          icon={ThumbsUp}
        />
      </div>

      <QuestionGeneratorForm
        outcomes={outcomes}
        subjects={subjects}
        preferenceStats={preferenceStats}
        canPersist={isSupabaseConfigured}
      />

      {/* ---------- Havuz onayi ---------- */}
      <Card>
        <CardHeader>
          <CardTitle>Soru havuzu onayi</CardTitle>
          <CardDescription>
            Onayladiginiz sorular egitmenin havuzuna duser ve sinavlarda
            kullanilabilir hale gelir. Reddedilenler havuza girmez.
            {isSupabaseConfigured ? null : " Demo modunda degisiklikler kaydedilmez."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionPoolTable questions={questions} persist={isSupabaseConfigured} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yuklenen kazanimlar</CardTitle>
          <CardDescription>
            {isSupabaseConfigured
              ? "Veritabanindaki kazanimlar."
              : "Demo verisi gosteriliyor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {outcomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground lg:col-span-2">
              Henuz kazanim eklenmemis.
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
