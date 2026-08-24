"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  EyeOff,
  Loader2,
  Printer,
  Send,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { setExamPublished } from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Exam } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Sinav detay sayfasinin kabugu.
 *
 * Onceden bu sayfa dort dev paneli ALT ALTA diziyordu: ayarlar, sinif
 * atamasi, yayin durumu ve soru kurma. Iki sorun vardi:
 *
 *   1. Sinavin BIRINCIL eylemi ("Yayina al") sayfanin ortasinda, iki panelin
 *      arasinda gomuluydu; egitmen ona ulasmak icin kaydirmak zorundaydi.
 *   2. Ayni sinavin uc ayri yonu (kurulumu, kime gidecegi, nasil basilacagi)
 *      tek bir dikey akista birbirine karisiyordu.
 *
 * Cozum: degismeyen ozet ve birincil eylem TEPEDE yapiskan bir seritte
 * duruyor - hangi sekmede olursaniz olun gorunur. Isin kendisi ise uc
 * sekmeye ayrildi: Kurulum / Sınıflar / Sınav Kağıdı.
 */

export interface ExamDetailTabsProps {
  exam: Exam;
  questionCount: number;
  totalPoints: number;
  /** Sinava atanmis toplam ogrenci sayisi; seritte ozet olarak gosterilir. */
  assignedCount: number;
  canPersist?: boolean;
  /** Sekme icerikleri; sunucuda cizilip buraya gecirilir. */
  kurulum: React.ReactNode;
  siniflar: React.ReactNode;
  kagit: React.ReactNode;
}

type Sekme = "kurulum" | "siniflar" | "kagit";

export function ExamDetailTabs({
  exam,
  questionCount,
  totalPoints,
  assignedCount,
  canPersist = true,
  kurulum,
  siniflar,
  kagit,
}: ExamDetailTabsProps) {
  const router = useRouter();
  const [sekme, setSekme] = React.useState<Sekme>("kurulum");
  const [pending, setPending] = React.useState(false);

  /** Sorusu olmayan sinav yayina alinamaz - kural sunucuda da var. */
  const yayinaAlinabilir = questionCount > 0;

  async function yayiniDegistir(next: boolean) {
    if (!canPersist) {
      toast.error("Tanıtım modunda kayıt yapılmaz");
      return;
    }

    setPending(true);
    const result = await setExamPublished(exam.id, next);
    setPending(false);

    if (!result.ok) {
      toast.error(next ? "Yayına alınamadı" : "Yayından çıkarılamadı", {
        description: result.error,
      });
      return;
    }

    toast.success(next ? "Sınav yayında" : "Sınav yayından çıkarıldı", {
      description: next
        ? assignedCount > 0
          ? `${assignedCount} öğrenci artık bu sınava girebilir.`
          : "Sınav açıldı ama henüz kimseye atanmadı — “Sınıflar” sekmesinden atayın."
        : "Öğrenciler bu sınavı artık görmeyecek.",
    });
    router.refresh();
  }

  return (
    <Tabs
      value={sekme}
      onValueChange={(value) => setSekme(value as Sekme)}
      className="space-y-4"
    >
      {/*
        Yapiskan serit. Panel ust cubugu 64px (h-16) ve sticky oldugu icin
        bu serit `top-16`e oturur. Negatif kenar bosluklari, serit
        yapistiginda arka planin icerik sutunundan TASIP tam genislik
        kaplamasi icin: aksi halde altindan kayan icerik kenarlardan
        gorunuyordu.
      */}
      <div className="sticky top-16 z-10 -mx-3 border-b bg-background/95 px-3 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge variant={exam.is_published ? "success" : "soft"}>
              {exam.is_published ? "Yayında" : "Taslak"}
            </Badge>

            <OzetOge
              icon={ClipboardList}
              text={`${questionCount} soru · ${totalPoints} puan`}
            />

            <OzetOge
              icon={Users}
              text={
                assignedCount > 0 ? `${assignedCount} öğrenci` : "Sınıf atanmadı"
              }
              tone={
                exam.is_published && assignedCount === 0 ? "warning" : "default"
              }
            />

            <OzetOge icon={CalendarClock} text={pencereMetni(exam)} />
          </div>

          <div className="flex items-center gap-2">
            {sekme === "kagit" ? null : (
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => setSekme("kagit")}
              >
                <Printer className="h-3.5 w-3.5" />
                Sınav kâğıdı
              </Button>
            )}

            <Button
              variant={exam.is_published ? "outline" : "default"}
              className="gap-2"
              disabled={pending || (!exam.is_published && !yayinaAlinabilir)}
              title={
                !exam.is_published && !yayinaAlinabilir
                  ? "Yayına almak için en az bir soru ekleyin"
                  : undefined
              }
              onClick={() => void yayiniDegistir(!exam.is_published)}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : exam.is_published ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {exam.is_published ? "Yayından çıkar" : "Yayına al"}
            </Button>
          </div>
        </div>

        {/*
          Yayina alinamama GEREKCESI butonun yaninda degil altinda: dar
          ekranda buton zaten alt satira duser ve tooltip dokunmatikte
          gorunmez, yani tek basina yeterli bir aciklama degil.
        */}
        {!exam.is_published && !yayinaAlinabilir ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Yayına almak için önce en az bir soru ekleyin.
          </p>
        ) : null}

        <TabsList className="mt-3 h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="kurulum" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Kurulum
          </TabsTrigger>
          <TabsTrigger value="siniflar" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Sınıflar
          </TabsTrigger>
          <TabsTrigger value="kagit" className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Sınav Kâğıdı
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="kurulum" className="mt-0 space-y-4 sm:space-y-6">
        {kurulum}
      </TabsContent>

      <TabsContent value="siniflar" className="mt-0">
        {siniflar}
      </TabsContent>

      {/*
        Kagit sekmesi MONTELI kalir (forceMount): okul adi, sinif ve yonerge
        gibi alanlar yalnizca ciktiyi biçimlendirdigi icin hicbir yere
        kaydedilmiyor. Sekme degistirildiginde bilesen sokulseydi egitmenin
        doldurdugu her alan sessizce silinirdi.
      */}
      <TabsContent value="kagit" forceMount className="mt-0 data-[state=inactive]:hidden">
        {kagit}
      </TabsContent>
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */

function OzetOge({
  icon: Icon,
  text,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone?: "default" | "warning";
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs sm:text-sm",
        tone === "warning" ? "font-medium text-warning" : "text-muted-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {text}
    </span>
  );
}

/** Sinav penceresini tek satirda anlatir. */
function pencereMetni(exam: Exam): string {
  if (!exam.starts_at && !exam.ends_at) return "Tarih sınırı yok";
  if (exam.starts_at && exam.ends_at) {
    return `${formatDateTime(exam.starts_at)} → ${formatDateTime(exam.ends_at)}`;
  }
  if (exam.starts_at) return `${formatDateTime(exam.starts_at)} sonrası`;
  return `${formatDateTime(exam.ends_at)} öncesi`;
}
