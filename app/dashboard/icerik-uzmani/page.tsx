import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  CircleDashed,
  Sparkles,
  Target,
  ThumbsUp,
  Wand2,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { OutcomeForm } from "@/components/shared/outcome-form";
import { PageHeader } from "@/components/shared/page-header";
import { QuestionGeneratorForm } from "@/components/shared/question-generator-form";
import { StatCard } from "@/components/shared/stat-card";
import { StepHeader } from "@/components/shared/step-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import {
  getOutcomes,
  getPreferences,
  getPreferenceStats,
  getQuestions,
} from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";

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

  /*
    Kazanim basina soru sayisi.
    Sorular bu sayfada ZATEN cekiliyor, bu yuzden ek sorgu yapmadan
    hesaplaniyor. Kazanim formunda "bu kazanim 24 soru topladi" diye
    gosteriliyor: dolu bir kazanimi gormek yeni kazanim yazma ihtiyacini
    azaltiyor ve veri tek yerde birikiyor.
  */
  const outcomeUsage = questions.reduce<Record<string, number>>((acc, question) => {
    if (question.outcome_id) acc[question.outcome_id] = (acc[question.outcome_id] ?? 0) + 1;
    return acc;
  }, {});

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
          hint={`${approved} soru onaylandı`}
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

      {/* ================= 1 - Kazanimlar ================= */}
      <StepHeader
        step={1}
        icon={Target}
        title="Kazanımlar"
        description="Ölçmenin hedefi. Üretilen her soru bir kazanıma bağlanır; öğrencinin gelişimi bu kırılımla raporlanır."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <OutcomeForm
          subjects={subjects}
          outcomes={outcomes}
          usage={outcomeUsage}
          canPersist={isSupabaseConfigured}
        />

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-primary" />
                Tanımlı kazanımlar
              </CardTitle>
              <CardDescription>
                {isSupabaseConfigured
                  ? "Üretim formunda bu listeden seçim yapılır."
                  : "Demo verisi gösteriliyor."}
              </CardDescription>
            </div>
            {outcomes.length > 0 ? (
              <Badge variant="soft" className="shrink-0">
                {outcomes.length}
              </Badge>
            ) : null}
          </CardHeader>

          <CardContent>
            {outcomes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
                <Target className="h-7 w-7 text-muted-foreground/50" />
                <p className="font-medium">Henüz kazanım yok</p>
                <p className="max-w-[15rem] text-sm text-muted-foreground">
                  Soldaki formu doldurup ilk kazanımınızı tanımlayın.
                </p>
              </div>
            ) : (
              /*
                Yukseklik siniri var: kazanim sayisi buyudugunde liste sayfayi
                metrelerce uzatiyordu ve altindaki uretim formu ekrandan
                cikiyordu. Liste kendi icinde kayiyor.
              */
              <ul className="max-h-[26rem] space-y-2.5 overflow-y-auto pr-1">
                {outcomes.map((outcome) => (
                  <li
                    key={outcome.id}
                    className="rounded-xl border p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {outcome.subject ? (
                        <Badge variant="soft" className="font-normal">
                          {outcome.subject}
                        </Badge>
                      ) : null}
                      <span className="text-sm font-medium">{outcome.topic}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {outcomeUsage[outcome.id]
                          ? `${outcomeUsage[outcome.id]} soru`
                          : formatDateTime(outcome.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed">
                      {outcome.outcome_text}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================= 2 - Soru uretimi ================= */}
      <StepHeader
        step={2}
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

      {/* ================= 3 - Havuz onayi ================= */}
      <StepHeader
        step={3}
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
