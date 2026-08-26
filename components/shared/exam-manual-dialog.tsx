"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Camera,
  Clock3,
  FileText,
  ListChecks,
  Loader2,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

import { createExamWithQuestions } from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNASSIGNED_SUBJECT } from "@/lib/question-pool";
import type { Question } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Elle sinav kurma penceresi.
 *
 * Egitmen sorulari zaten TEK TEK secmis durumda; bu pencere secimi
 * paketlemekle kalmiyor, sinavin butun ayarlarini birlikte soruyor: ad,
 * ders, sure, kamera zorunlulugu ve soru basina puan.
 *
 * Ayarlari sinav kuruldiktan SONRA ayri bir ekranda toplamak, egitmeni
 * sinavi kurup sonra ayarlara gidip tek tek doldurmaya zorluyordu. Kurma
 * ani zaten butun kararlarin verildigi an.
 *
 * Puan iki turlu belirlenebiliyor: esit dagitim (100 uzerinden) ya da soru
 * basina elle. Elle girildiginde otomatik dagitim kapaniyor, boylece
 * sonradan soru eklemek girilen degerleri silmiyor.
 */

export interface ExamManualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Isaretlenen sorular; pencerede tek tek listelenir. */
  questions: readonly Question[];
  /** Tanitim modunda kayit yapilmaz; dugme kapatilir. */
  canPersist?: boolean;
  onCreated?: () => void;
}

type PuanModu = "esit" | "elle";

export function ExamManualDialog({
  open,
  onOpenChange,
  questions,
  canPersist = true,
  onCreated,
}: ExamManualDialogProps) {
  const router = useRouter();

  const [baslik, setBaslik] = React.useState("");

  /*
    Dersler SECILMEZ, secilen sorulardan TURETILIR.

    Onceden burada tek bir ders kutusu vardi; oysa egitmen havuzdan uc ayri
    dersten soru isaretleyip bu pencereye gelebiliyor ve tek ders secmek
    zorunda kaliyordu. Sinavin dersi zaten sorularinin dersidir - iki ayri
    gercek tutmanin anlami yok.

    Yetki tarafi da ayni kaynagi kullanir: uygulandi/2026-08-26-cok-dersli-sinav.sql
    ile gorunurluk `exam_subjects()` uzerinden, yani yine sorulardan
    hesaplanir.
  */
  const dersler = React.useMemo(() => {
    const kume = new Set<string>();
    for (const question of questions) {
      const ad = question.subject?.trim();
      // "Ders atanmamis" bir ders ADI DEGIL, dersi girilmemis sorularin
      // toplandigi yer tutucudur (bkz. lib/question-pool.ts).
      if (ad && ad !== UNASSIGNED_SUBJECT) kume.add(ad);
    }
    return [...kume].sort((a, b) => a.localeCompare(b, "tr"));
  }, [questions]);
  const [sure, setSure] = React.useState("60");
  const [kamera, setKamera] = React.useState(false);
  const [puanModu, setPuanModu] = React.useState<PuanModu>("esit");
  const [puanlar, setPuanlar] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setBaslik("");
    // Ders artik sifirlanmiyor: secilmiyor, sorulardan turetiliyor.
    setSure("60");
    setKamera(false);
    setPuanModu("esit");

    // Elle moda gecildiginde bos alanlarla karsilasmasin diye esit
    // dagitimla on doldurulur.
    const adet = questions.length;
    if (adet > 0) {
      const taban = Math.floor(100 / adet);
      const artan = 100 - taban * adet;
      const baslangic: Record<string, string> = {};
      questions.forEach((question, index) => {
        baslangic[question.id] = String(
          Math.max(1, taban + (index < artan ? 1 : 0)),
        );
      });
      setPuanlar(baslangic);
    }
  }, [open, questions]);

  const testAdedi = questions.filter((q) => q.type === "test").length;
  const klasikAdedi = questions.length - testAdedi;

  const toplamPuan = React.useMemo(() => {
    if (puanModu === "esit") return 100;
    return questions.reduce((sum, question) => {
      const deger = Number.parseInt(puanlar[question.id] ?? "", 10);
      return sum + (Number.isFinite(deger) ? deger : 0);
    }, 0);
  }, [puanModu, puanlar, questions]);

  const puanlarGecerli =
    puanModu === "esit" ||
    questions.every((question) => {
      const deger = Number.parseInt(puanlar[question.id] ?? "", 10);
      return Number.isInteger(deger) && deger >= 1 && deger <= 100;
    });

  const gecerli =
    baslik.trim().length > 0 && questions.length > 0 && puanlarGecerli;

  async function olustur() {
    if (!gecerli) return;

    const dakika = Number.parseInt(sure.trim(), 10);

    const elle =
      puanModu === "elle"
        ? Object.fromEntries(
            questions.map((question) => [
              question.id,
              Number.parseInt(puanlar[question.id] ?? "", 10),
            ]),
          )
        : undefined;

    /*
      `exams.subject` yalnizca TEK dersli sinavda yazilir.

      Cok dersliyken bos birakilir: sutun tek bir metin tutuyor ve ucunden
      birini secmek digerlerini gizlemek olurdu. Gorunurluk zaten sutundan
      degil sorulardan hesaplaniyor (bkz. exam_subjects), dolayisiyla bos
      kalmasi yetkiyi gevsetmez - sutun burada yalnizca rozet/suzgec gibi
      gorsel isler icin duruyor.
    */
    const gecerliDers = dersler.length === 1 ? (dersler[0] ?? "") : "";

    setPending(true);

    try {
      const result = await createExamWithQuestions({
        title: baslik,
        description: "Soru havuzundan seçilerek hazırlandı.",
        ...(gecerliDers ? { subject: gecerliDers } : {}),
        ...(Number.isFinite(dakika) ? { durationMinutes: dakika } : {}),
        proctored: kamera,
        questionIds: questions.map((question) => question.id),
        ...(elle ? { points: elle } : {}),
      });

      if (!result.ok) throw new Error(result.error);

      toast.success("Sınav oluşturuldu", {
        description: `${result.data.added} soru eklendi.`,
      });

      onOpenChange(false);
      onCreated?.();
      router.push(`/dashboard/egitmen/sinavlar/${result.data.id}`);
    } catch (caught) {
      toast.error("Sınav oluşturulamadı", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Yeni sınav</DialogTitle>
          <DialogDescription>
            Seçtiğiniz {questions.length} soruyla sınav oluşturun. Süre, kamera
            kuralı ve puan dağılımını burada belirleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* ================= Sol: sınav ayarları ================= */}
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="manual-title">Sınav adı</Label>
              <Input
                id="manual-title"
                value={baslik}
                onChange={(event) => setBaslik(event.target.value)}
                placeholder="Biyoloji 1. Dönem Yazılı"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
                {dersler.length > 1 ? "Dersler" : "Ders"}
              </span>

              {dersler.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                  Seçilen soruların dersi belirtilmemiş.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/40 px-3 py-2.5">
                  {dersler.map((ad) => (
                    <Badge key={ad} variant="soft">
                      {ad}
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted-foreground">
                {dersler.length === 0
                  ? "Sınav tüm eğitmenlere açık kalır."
                  : dersler.length === 1
                    ? "Seçtiğiniz soruların dersinden alındı. Sınavı yalnızca bu derse yetkili eğitmenler görür."
                    : "Seçtiğiniz soruların derslerinden alındı. Sınavı bu derslerden herhangi birine yetkili eğitmenler görür."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-sure" className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                Süre (dakika)
              </Label>
              <Input
                id="manual-sure"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={sure}
                onChange={(event) => setSure(event.target.value)}
                className="sayi-oksuz w-32"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Her öğrenci sınava başladığı andan itibaren bu süreyi alır.
              </p>
            </div>

            <label
              htmlFor="manual-kamera"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                kamera ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
              )}
            >
              <Checkbox
                id="manual-kamera"
                checked={kamera}
                onChange={(event) => setKamera(event.target.checked)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Camera className="h-3.5 w-3.5" />
                  Kamera zorunlu olsun
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  Öğrenci sınava ancak kamerası ve mikrofonu açıkken girer.
                  Görüntü kaydedilmez.
                </span>
              </span>
            </label>
          </div>

          {/* ================= Sağ: sorular ve puanlar ================= */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Sorular ve puanlar</Label>

              <div className="flex items-center gap-1.5">
                <PuanModuDugmesi
                  secili={puanModu === "esit"}
                  onSelect={() => setPuanModu("esit")}
                  label="Eşit dağıt"
                  icon={<Scale className="h-3.5 w-3.5" />}
                />
                <PuanModuDugmesi
                  secili={puanModu === "elle"}
                  onSelect={() => setPuanModu("elle")}
                  label="Elle gir"
                  icon={<ListChecks className="h-3.5 w-3.5" />}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="soft">{testAdedi} test</Badge>
              <Badge variant="soft">{klasikAdedi} klasik</Badge>
              <span aria-hidden>·</span>
              {/*
                Toplam puanin 100 olmasi ZORUNLU DEGIL: hoca 50 puanlik bir
                sinav da yapabilir. 100 yalnizca "Esit dagit"in varsayilani,
                bir kural degil - bu yuzden farkli bir toplam uyari degil.
              */}
              <span className="font-medium text-foreground">
                toplam {toplamPuan} puan
              </span>
            </div>

            <ol className="kaydirma-ince max-h-[46vh] space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {questions.map((question, index) => (
                <li
                  key={question.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent/40"
                >
                  <span className="tabular mt-0.5 w-5 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                    {index + 1}.
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm leading-snug">
                      {question.text}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {question.type === "test" ? (
                        <ListChecks className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      {question.type === "test" ? "Çoktan seçmeli" : "Açık uçlu"}
                      <span aria-hidden>·</span>
                      {question.topic}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      value={
                        puanModu === "esit"
                          ? esitPuan(index, questions.length)
                          : (puanlar[question.id] ?? "")
                      }
                      disabled={puanModu === "esit"}
                      onChange={(event) =>
                        setPuanlar((mevcut) => ({
                          ...mevcut,
                          [question.id]: event.target.value,
                        }))
                      }
                      aria-label={`${index + 1}. sorunun puanı`}
                      className="sayi-oksuz h-9 w-16 text-center"
                    />
                    <span className="text-xs text-muted-foreground">puan</span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {puanModu === "esit"
                ? "Puanlar 100 üzerinden eşit dağıtılır; tam bölünmezse artan puan baştaki sorulara verilir."
                : "Toplamın 100 olması gerekmez; dilediğiniz puanlamayı kurabilirsiniz. Elle puan girdiğinizde otomatik dağıtım kapanır ve sonradan soru eklemek girdiğiniz değerleri değiştirmez."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button disabled={!gecerli || pending || !canPersist} onClick={() => void olustur()}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Sınavı oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

/** Esit dagitimda bir sorunun payi; migration'daki kuralla ayni. */
function esitPuan(index: number, adet: number): number {
  if (adet === 0) return 0;
  if (adet > 100) return 1;
  const taban = Math.floor(100 / adet);
  const artan = 100 - taban * adet;
  return taban + (index < artan ? 1 : 0);
}

function PuanModuDugmesi({
  secili,
  onSelect,
  label,
  icon,
}: {
  secili: boolean;
  onSelect: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={secili}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        secili
          ? "border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent/60",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
