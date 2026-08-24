import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Layers,
  Library,
} from "lucide-react";

import { AiMockNotice } from "@/components/shared/ai-mock-notice";
import { ExamStatusAlerts } from "@/components/shared/exam-status-alerts";
import { PageHeader } from "@/components/shared/page-header";
import { OutcomeAnalysis } from "@/components/shared/outcome-analysis";
import { PendingByClassroom } from "@/components/shared/pending-by-classroom";
import { QuickActions } from "@/components/shared/quick-actions";
import { StatCard } from "@/components/shared/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { buildExamAlerts } from "@/lib/exam-alerts";
import { isSupabaseConfigured, serverEnv } from "@/lib/env";
import {
  getClassroomExamReviews,
  getExamSummaries,
  getOutcomeAnalysis,
  getQuestions,
  getSubmissions,
} from "@/lib/queries";
import { grantedRoles } from "@/lib/roles";
import { getCurrentUser } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Eğitmen" };

export default async function EgitmenPage() {
  const [questions, exams, submissions, classroomReviews, outcomeAnalysis] =
    await Promise.all([
      getQuestions(),
      getExamSummaries(),
      getSubmissions(),
      getClassroomExamReviews(),
      getOutcomeAnalysis(),
    ]);

  // Eğitmen yalnızca havuza dusmus (onaylı) sorularla ilgilenir; taslak
  // inceleme ve onay/red içerik uzmaninin ekranindadir.
  const approved = questions.filter((q) => q.status === "onayli");
  const topicCount = new Set(approved.map((q) => q.topic)).size;
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "ai_degerlendirildi",
  );

  /*
    Sinav basina atanmis ogrenci sayisi.

    Ayri bir sorgu ACILMIYOR: `getClassroomExamReviews` zaten atamalardan
    turetiliyor ve bu sayfa onu her halukarda okuyor. Atamasi olmayan sinav
    hic satir uretmedigi icin haritada bulunmamasi "0 ogrenci" demektir -
    uyari mantiginin aradigi bilgi tam olarak budur.
  */
  const assignedByExam = new Map<string, number>();
  for (const review of classroomReviews) {
    assignedByExam.set(
      review.exam.id,
      (assignedByExam.get(review.exam.id) ?? 0) + review.assignedCount,
    );
  }

  /*
    "Simdi" TEK BIR AN olarak sabitlenir. Satir satir `Date.now()` cagirmak
    ayni listedeki sinavlari birbirinden milisaniyeler farkli anlara gore
    degerlendirmek olurdu.
  */
  const alerts = buildExamAlerts(
    exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      is_published: exam.is_published,
      ends_at: exam.ends_at,
      questionCount: exam.questionCount,
      assignedCount: assignedByExam.get(exam.id) ?? 0,
    })),
    Date.now(),
  );

  const pendingReviewCount = classroomReviews.reduce(
    (sum, review) => sum + review.pendingCount,
    0,
  );

  /*
    KAZANIM PANELINDEKI "soru uret" BAGLANTISI.

    Baglanti icerik uzmaninin ekranina gidiyor ve o ekran ROLE BAGLI:
    middleware, `icerik_uzmani` rolu olmayan kisiyi kendi paneline geri
    atiyor. Kosulsuz gosterildiginde tiklayan egitmen hicbir aciklama
    almadan ayni sayfaya donuyordu - calisan degil, SESSIZCE OLU bir dugme.
    Artik yalnizca o role gercekten sahip olana gosteriliyor.
  */
  const current = isSupabaseConfigured ? await getCurrentUser() : null;
  const canGenerateQuestions = current
    ? grantedRoles(current.profile).includes("icerik_uzmani")
    : false;

  return (
    <>
      <PageHeader
        title="Genel Bakış"
        description="Havuzdan sınav oluşturun, öğrenci cevaplarının puanlarını onaylayın."
        actions={
          <Link
            href="/dashboard/egitmen/sinavlar"
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ClipboardList className="h-4 w-4" />
            Tüm sınavlar
          </Link>
        }
      />

      <QuickActions
        actions={[
          {
            href: "/dashboard/egitmen/kontrol",
            label: "Sınav kontrolü",
            description: "Sınıf bazlı bütün değerlendirme, toplu puan onayı",
            icon: ClipboardCheck,
            count: pendingReviewCount,
            emphasis: true,
          },
          {
            href: "/dashboard/egitmen/soru-havuzu",
            label: "Soru havuzu",
            description: "Ders ve konuya göre gezin, seçtiklerinden sınav kurun",
            icon: Library,
            count: approved.length,
          },
          {
            href: "/dashboard/egitmen/sinavlar",
            label: "Sınavlar",
            description: "Yeni sınav oluşturun, yayına alın, kâğıdını yazdırın",
            icon: ClipboardList,
            count: exams.length,
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Havuzdaki soru"
          value={approved.length}
          hint="Sınavlarda kullanılabilir"
          icon={Library}
          accent="success"
        />
        <StatCard
          label="Konu"
          value={topicCount}
          hint="Havuzda temsil edilen"
          icon={Layers}
          accent="primary"
        />
        <StatCard
          label="Sınav"
          value={exams.length}
          hint={`${exams.filter((exam) => exam.is_published).length} tanesi yayında`}
          icon={CalendarClock}
        />
        <StatCard
          label="Puan onayı bekleyen"
          value={pendingSubmissions.length}
          hint="AI değerlendirdi"
          icon={FileCheck2}
          accent="primary"
        />
      </div>

      {serverEnv.aiMockMode ? <AiMockNotice capability="puanlama" /> : null}

      <PendingByClassroom reviews={classroomReviews} />

      {/*
        SINAV DURUMU.
        Sayilar bir sinavin YAYINDA OLUP kimseye atanmadigini soylemiyordu;
        oyle bir sinav kimse fark etmeden orada duruyordu. Bu panel sayiyi
        degil yapilacak isi gosterir.

        Buranin oncesinde "Sinavlarim" diye bir kart vardi: /sinavlar
        sayfasinin daha az bilgi tasiyan, üstelik TIKLANAMAYAN bir kopyasi.
        Ayni listeyi iki yerde tutmak yerine ust basliktaki "Tüm sınavlar"
        baglantisi birakildi.
      */}
      <ExamStatusAlerts alerts={alerts} />

      {/*
        SINIFIN OGRENME DURUMU.
        Sartnamenin 2. slaydi "egitmen sinifin ogrenme durumunu tek ekrandan
        gorur" diyor. Sinav ortalamasi bunu vermiyordu: "%61" hangi parcanin
        zayif oldugunu soylemiyor.

        En zayif 5 kazanim gosteriliyor - panel bir ozet ekrani, tam liste
        yonetici raporunda.
      */}
      <OutcomeAnalysis
        rows={outcomeAnalysis}
        canGenerate={canGenerateQuestions}
        limit={5}
      />
    </>
  );
}
