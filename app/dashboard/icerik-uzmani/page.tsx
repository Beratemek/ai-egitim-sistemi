import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleDashed,
  ListChecks,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionGeneratorForm } from "@/components/shared/question-generator-form";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import {
  getOutcomes,
  getPreferences,
  getQuestions,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "İçerik Uzmanı" };

export default async function IcerikUzmaniPage() {
  const [outcomes, questions, preferences] = await Promise.all([
    getOutcomes(),
    getQuestions(),
    getPreferences(),
  ]);

  const liked = preferences.filter((item) => item.verdict === "begendi").length;

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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
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
          value={preferences.length}
          hint={`${liked} beğeni · ${preferences.length - liked} red`}
          icon={ThumbsUp}
        />
      </div>

      {serverEnv.aiMockMode ? <AiMockNotice capability="uretim" /> : null}

      <QuestionGeneratorForm
        subjects={subjects}
        outcomes={outcomes}
        preferences={preferences}
        canPersist={isSupabaseConfigured}
      />

      {/*
        Havuz onayi ARTIK AYRI SAYFADA (/dashboard/icerik-uzmani/soru-havuzu).
        Burada yalnizca oraya goturen bir cagri duruyor: 300+ soruluk havuz bu
        sayfanin dibinde kaldiginda uzman onay icin her seferinde uretim
        formunu gecip asagi iniyordu.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4.5 w-4.5 text-primary" />
            Soru havuzu onayı
          </CardTitle>
          <CardDescription>
            Ürettiğiniz sorular ders ve konu başlıkları altında sizi bekliyor.
            Onayladıklarınız eğitmenin havuzuna düşer ve sınavlarda
            kullanılabilir hale gelir.
            {isSupabaseConfigured ? null : " Tanıtım modunda kayıt yapılmaz."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button asChild className="gap-1.5">
            <Link href="/dashboard/icerik-uzmani/soru-havuzu">
              Havuzu aç
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {pending > 0 ? (
            <span className="text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">{pending}</strong>{" "}
              soru onayınızı bekliyor.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Onay bekleyen soru yok.
            </span>
          )}
        </CardContent>
      </Card>

      {/*
        Kazanim arsivi.

        Amaci TEKRAR KULLANIM: yukaridaki formun "Kayıtlı kazanımdan doldur"
        secicisi bu kayitlari okuyor ve secilen kazanimi (dal, konu, kazanim
        cumlesi ve kaynak metniyle birlikte) forma yaziyor. Burasi ise ayni
        kayitlarin kaynak metnini gorup dogru olani secmek icin - secicide
        yalnizca ilk satiri gorunuyor.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı kazanımlar</CardTitle>
          <CardDescription>
            {isSupabaseConfigured
              ? "Daha önce yüklediğiniz kazanımlar. Aynı kazanımdan yeniden soru üretmek için yukarıdaki formda “Kayıtlı kazanımdan doldur” listesinden seçin — kaynak metin de birlikte dolar."
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
