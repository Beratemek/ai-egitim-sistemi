import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  CircleDashed,
  Sparkles,
  Target,
  ThumbsUp,
  Wand2,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionGeneratorForm } from "@/components/shared/question-generator-form";
import { StatCard } from "@/components/shared/stat-card";
import { StepHeader } from "@/components/shared/step-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import {
  getOutcomes,
  getPreferences,
  getPreferenceStats,
  getQuestions,
} from "@/lib/queries";

export const metadata: Metadata = { title: "İçerik Uzmanı" };

/**
 * Icerik uzmani ekrani.
 *
 * Sayfa, isin GERCEK SIRASINI izler ve bolumler numaralandirilmistir:
 *
 *   1. Kazanim tanimla   - olcmenin hedefi
 *   2. Soru uret         - kazanimdan taslak
 *   3. Havuza onayla     - egitmenin kullanabilecegi hale getir
 *
 * Once kazanim formu uretimin ALTINDA duruyordu; kullanici henuz
 * tanimlamadigi bir kazanimi secmeye calisiyordu.
 *
 * `?kazanim=<id>` ile gelinirse o kazanim uretim formunda HAZIR SECILI olur.
 * Baglanti egitmen panelindeki kazanim analizinden geliyor ("bu kazanima
 * tekrar sorusu uret"). Adres satiri kullanildi, global durum degil:
 * paylasilabilir, geri tusu calisir ve iki sayfa arasinda gizli bir
 * bagimlilik olusmaz.
 */
export default async function IcerikUzmaniPage({
  searchParams,
}: {
  searchParams: Promise<{ kazanim?: string }>;
}) {
  const [
    { kazanim: requestedOutcomeId },
    [outcomes, questions, preferenceStats, preferences],
  ] = await Promise.all([
    searchParams,
    Promise.all([
      getOutcomes(),
      getQuestions(),
      getPreferenceStats(),
      getPreferences(),
    ] as const),
  ]);

  // Forma öneri olarak verilir; ayni ders iki farklı yazimla girilmesin.
  // Kazanımlardaki dersler de listeye katiliyor: henüz soru üretilmemiş bir
  // ders yalnızca kazanım kaydında bulunabilir.
  const subjects = [
    ...new Set([
      ...questions.map((question) => question.subject),
      ...outcomes.map((outcome) => outcome.subject ?? ""),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "tr"));

  const aiGenerated = questions.filter((question) => question.ai_generated).length;
  const pending = questions.filter((question) => question.status === "taslak").length;
  const approved = questions.filter((question) => question.status === "onayli").length;

  /** Kazanıma bağlı soru oranı - kazanım bazlı raporlamanın kapsamı. */
  const linked = questions.filter((question) => question.outcome_id !== null).length;


  return (
    <>
      <PageHeader
        title="İçerik & Kazanımlar"
        description="Kazanımı tanımlayın, kaynak metinden AI ile soru taslağı üretin, onaylayarak havuza gönderin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kazanım"
          value={outcomes.length}
          hint={
            questions.length > 0
              ? `${linked} soru bir kazanıma bağlı`
              : "Ölçmenin hedefi"
          }
          icon={Target}
          accent="cat1"
        />
        <StatCard
          label="Üretilen soru"
          value={aiGenerated}
          hint="AI kaynaklı"
          icon={Sparkles}
          accent="cat2"
        />
        <StatCard
          label="Onay bekleyen"
          value={pending}
          hint={`${approved} soru onaylandı`}
          icon={CircleDashed}
          accent="cat3"
        />
        <StatCard
          label="Tarz örneği"
          value={preferenceStats.liked + preferenceStats.disliked}
          hint={`${preferenceStats.liked} beğeni · ${preferenceStats.disliked} red`}
          icon={ThumbsUp}
          accent="cat4"
        />
      </div>

      {serverEnv.aiMockMode ? <AiMockNotice capability="uretim" /> : null}

      {/*
        AYRI "Kazanimlar" ADIMI KALDIRILDI.

        Iki yuzey vardi ve ikisi de uretim formundan KOPUKTU: solda kazanim
        tanimlama formu, sagda salt okunur "Tanimli kazanimlar" listesi.
        Kullanici uretim formunu doldururken aradigi kazanimi bulamayinca
        sayfanin tepesine cikip baska bir forma gecmek zorunda kaliyordu.

        Ikisi de uretim formundaki kazanim alanina tasindi: yazarken
        eslesenler altta beliriyor, eslesme yoksa ayni alandan yeni kazanim
        kaydediliyor (bkz. OutcomeSearchField). Tekrar kontrolu server
        action'da (createOutcome -> findSimilarOutcome) zaten yapiliyor,
        yani ayri formla birlikte kaybolmadi.
      */}
      {/* ================= 1 - Soru uretimi ================= */}
      <StepHeader
        step={1}
        icon={Wand2}
        title="Soru üretimi"
        description="Kazanımı seçin, kaynak metni verin. Taslakları beğenip reddettikçe AI o dersteki tarzınızı öğrenir."
      />

      <QuestionGeneratorForm
        subjects={subjects}
        outcomes={outcomes}
        preferenceStats={preferenceStats}
        preferences={preferences}
        canPersist={isSupabaseConfigured}
        {...(requestedOutcomeId ? { initialOutcomeId: requestedOutcomeId } : {})}
      />

      {/* ================= 2 - Havuz onayi ================= */}
      <StepHeader
        step={2}
        icon={CheckCheck}
        title="Havuz onayı"
        description={
          isSupabaseConfigured
            ? "Onayladığınız sorular eğitmenin havuzuna düşer ve sınavlarda kullanılabilir. Reddedilenler havuza girmez."
            : "Tanıtım modunda kayıt yapılmaz."
        }
      />

      {/*
        Havuz onayi AYRI SAYFADA (/dashboard/icerik-uzmani/soru-havuzu).
        300+ soruluk havuz bu sayfanin dibinde kaldiginda uzman her onay icin
        kazanim formunu ve uretim formunu gecip asagi iniyordu. Uretim bir
        oturum isi, onay ayri bir oturum.
      */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Button asChild className="gap-1.5">
            <Link href="/dashboard/icerik-uzmani/soru-havuzu">
              Havuzu aç
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {pending > 0 ? (
              <>
                <strong className="font-semibold text-foreground">{pending}</strong>{" "}
                soru onayınızı bekliyor · ders ve konu başlıkları altında gruplu.
              </>
            ) : (
              "Onay bekleyen soru yok."
            )}
          </span>
        </CardContent>
      </Card>
    </>
  );
}
