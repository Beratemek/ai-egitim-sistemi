import type { Metadata } from "next";
import { BookOpen, CircleDashed, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { QuestionGeneratorForm } from "@/components/shared/question-generator-form";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_OUTCOMES, MOCK_QUESTIONS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Icerik Uzmani" };

export default function IcerikUzmaniPage() {
  const aiGenerated = MOCK_QUESTIONS.filter((question) => question.ai_generated).length;
  const pending = MOCK_QUESTIONS.filter((q) => q.status === "taslak").length;

  return (
    <>
      <PageHeader
        title="Icerik & Kazanimlar"
        description="Kaynak metinleri yukleyin, kazanimlari tanimlayin ve AI ile soru taslagi uretin."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Kazanim"
          value={MOCK_OUTCOMES.length}
          icon={BookOpen}
          accent="primary"
        />
        <StatCard
          label="Uretilen soru"
          value={aiGenerated}
          hint="AI kaynakli taslaklar"
          icon={Sparkles}
          accent="success"
        />
        <StatCard
          label="Onay bekleyen"
          value={pending}
          hint="Egitmen incelemesinde"
          icon={CircleDashed}
          accent="warning"
        />
      </div>

      <QuestionGeneratorForm />

      <Card>
        <CardHeader>
          <CardTitle>Yuklenen kazanimlar</CardTitle>
          <CardDescription>Demo verisi gosteriliyor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {MOCK_OUTCOMES.map((outcome) => (
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
          ))}
        </CardContent>
      </Card>
    </>
  );
}
