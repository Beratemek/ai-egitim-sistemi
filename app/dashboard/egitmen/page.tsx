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

import { PageHeader } from "@/components/shared/page-header";
import { PendingByClassroom } from "@/components/shared/pending-by-classroom";
import { QuickActions } from "@/components/shared/quick-actions";
import { StatCard } from "@/components/shared/stat-card";
import { buttonVariants } from "@/components/ui/button";

import { serverEnv } from "@/lib/env";
import {
  getClassroomExamReviews,
  getExamSummaries,
  getQuestions,
  getSubmissions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Eğitmen" };

export default async function EgitmenPage() {
  const [questions, exams, submissions, classroomReviews] =
    await Promise.all([
      getQuestions(),
      getExamSummaries(),
      getSubmissions(),
      getClassroomExamReviews(),
    ]);

  // Eğitmen yalnızca havuza dusmus (onaylı) sorularla ilgilenir; taslak
  // inceleme ve onay/red içerik uzmaninin ekranindadir.
  const approved = questions.filter((q) => q.status === "onayli");
  const topicCount = new Set(approved.map((q) => q.topic)).size;
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "ai_degerlendirildi",
  );

  const pendingReviewCount = classroomReviews.reduce(
    (sum, review) => sum + review.pendingCount,
    0,
  );

  /*
    Buradaki `getCurrentUser` cagrisi ve `canGenerateQuestions` bayragi
    KALDIRILDI: yalnizca kazanim panelindeki "soru uret" baglantisini role
    gore gizlemek icin vardi. Panel yoneticiye tasindigi icin bu ekranda
    kullanicinin rolune bakmaya gerek kalmadi - sayfa bir Supabase cagrisi
    daha az yapiyor.
  */

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
        SINAV DURUMU PANELI KALDIRILDI (2026-08-24).

        Bilesen ve mantik SILINMEDI: components/shared/exam-status-alerts.tsx
        ile lib/exam-alerts.ts (ve testleri) oldugu gibi duruyor; gerekirse
        tek satirla geri baglanir. Bu sayfa artik yalnizca gunluk isi
        gosteriyor: hizli eylemler, sayilar ve sinif bazli puan onayi.
      */}

      {/*
        KAZANIM BAZLI BASARI PANELI BURADAN KALDIRILDI (2026-08-24).

        Kazanim analizi ve ondan cikarilan istatistik/raporlama EGITIM
        YONETICISININ isi; panel /dashboard/yonetici sayfasinda duruyor ve
        orada tam liste halinde. Egitmen panelinde 5 satirlik kirpilmis bir
        kopyasi vardi: egitmenin gunluk isi (puan onayi, sinav kurma, sinav
        durumu) ile ayni ekranda yarisiyor, "58 kazanim daha var" deyip
        eyleme donusmeyen bir blok olarak yer kapliyordu.
      */}
    </>
  );
}
