"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  FileText,
  ListChecks,
  Loader2,
  Sparkles,
  TriangleAlert,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  countByType,
  countTopicsByType,
  difficultyOf,
  pickBalancedByType,
  UNASSIGNED_SUBJECT,
  type SubjectGroup,
} from "@/lib/question-pool";
import { DIFFICULTY_LABELS, type QuestionDifficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Sinav kurma penceresi.
 *
 * Pencere sinavi KENDISI kuruyor: ders, konu ve soru sayisini burada
 * soruyor. Onceki surumde yalnizca listeden isaretlenmis sorulari aliyordu,
 * yani egitmen zaten butun secim isini yapmis oluyordu ve pencerenin
 * yaptigi bir sey kalmiyordu.
 *
 * Konu secimi ISTEGE BAGLI ve COKLU: bos birakilirsa dersin tum konulari
 * kapsama girer. Bir donem sinavi genelde birkac konuyu birden kapsar;
 * tek konu secmeye zorlamak gercek kullanimi karsilamazdi.
 *
 * Sorular konular arasinda DENGELI dagitilir - 10 testin hepsi tek konudan
 * gelmez. Bu kural tabanli bir secim; soru metinlerini yapay zeka uretiyor
 * ama sinavi kuran bu adim deterministik.
 */

export interface ExamComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Havuzdaki dersler ve konulari; secim kutulari bundan cizilir. */
  subjects: readonly SubjectGroup[];
  /** Pencere acilirken on secili gelecek ders. */
  defaultSubject?: string | null;
  /** Tanitim modunda kayit yapilmaz; dugme kapatilir. */
  canPersist?: boolean;
  onCreated?: () => void;
}

export function ExamComposeDialog({
  open,
  onOpenChange,
  subjects,
  defaultSubject = null,
  canPersist = true,
  onCreated,
}: ExamComposeDialogProps) {
  const router = useRouter();

  const [baslik, setBaslik] = React.useState("");
  const [ders, setDers] = React.useState<string>("");
  const [konular, setKonular] = React.useState<ReadonlySet<string>>(new Set());
  const [testSayisi, setTestSayisi] = React.useState("10");
  const [klasikSayisi, setKlasikSayisi] = React.useState("5");
  const [sure, setSure] = React.useState("60");
  /*
    "İşaretlediklerimden" KAYNAGI KALDIRILDI (2026-08-24).

    Bu pencere iki kaynak sunuyordu: dersten dengeli secim, ya da havuzda
    isaretlenmis sorular. Ikincisi kafa karistiriciydi - ayni isi zaten
    havuz ekranindaki "Yeni sinav" akisi yapiyor. Burasi artik TEK ISE
    odakli: ders + konu + soru sayisi ver, sistem dengeli sinav kursun.
  */
  /*
    Sinavin zorlugu. VARSAYILAN "orta": egitmen hicbir sey secmeden
    devam ederse dengeli bir sinav cikar. "hepsi" zorluk gozetmez.
  */
  const [zorluk, setZorluk] = React.useState<"hepsi" | QuestionDifficulty>(
    "orta",
  );
  const [pending, setPending] = React.useState(false);

  // Pencere her acilista temiz baslasin; onceki denemenin artiklari kalmasin.
  React.useEffect(() => {
    if (!open) return;
    setBaslik("");
    setKonular(new Set());
    setZorluk("orta");
    setDers(defaultSubject ?? subjects[0]?.subject ?? "");
  }, [open, defaultSubject, subjects]);

  const acikDers = React.useMemo(
    () => subjects.find((group) => group.subject === ders) ?? null,
    [subjects, ders],
  );

  /**
   * Kapsam: konu secilmediyse dersin TUM konulari, ustune zorluk suzgeci.
   *
   * Zorluk KAPSAMI daraltir, modele ayri bir istek olarak GITMEZ: bu pencere
   * havuzdaki HAZIR sorulardan sinav kuruyor, yeni soru uretmiyor. Yani
   * "zor sinav" = "havuzdaki zor sorulardan kur".
   */
  const kapsam = React.useMemo(() => {
    if (!acikDers) return [];
    const konuyaGore =
      konular.size === 0
        ? acikDers.topics
        : acikDers.topics.filter((topic) => konular.has(topic.topic));

    if (zorluk === "hepsi") return konuyaGore;

    return konuyaGore
      .map((topic) => ({
        ...topic,
        questions: topic.questions.filter(
          (question) => difficultyOf(question) === zorluk,
        ),
      }))
      .filter((topic) => topic.questions.length > 0);
  }, [acikDers, konular, zorluk]);

  const mevcut = React.useMemo(() => {
    let test = 0;
    let acik = 0;
    for (const group of kapsam) {
      for (const question of group.questions) {
        if (question.type === "test") test += 1;
        else acik += 1;
      }
    }
    return { test, acik };
  }, [kapsam]);

  const istenenTest = Number.parseInt(testSayisi, 10);
  const istenenKlasik = Number.parseInt(klasikSayisi, 10);
  const toplamIstenen =
    (Number.isFinite(istenenTest) ? Math.max(0, istenenTest) : 0) +
    (Number.isFinite(istenenKlasik) ? Math.max(0, istenenKlasik) : 0);

  const gecerli =
    baslik.trim().length > 0 &&
    Boolean(acikDers) &&
    toplamIstenen > 0;

  function konuDegistir(konu: string) {
    setKonular((mevcut) => {
      const next = new Set(mevcut);
      if (next.has(konu)) next.delete(konu);
      else next.add(konu);
      return next;
    });
  }

  async function olustur() {
    if (!gecerli) return;

    let ids: string[];

    {
      const sonuc = pickBalancedByType(kapsam, {
        test: Number.isFinite(istenenTest) ? Math.max(0, istenenTest) : 0,
        acikUclu: Number.isFinite(istenenKlasik) ? Math.max(0, istenenKlasik) : 0,
      });

      ids = sonuc.ids;

      if (sonuc.eksik.test > 0 || sonuc.eksik.acikUclu > 0) {
        const eksikler = [
          sonuc.eksik.test > 0 ? `${sonuc.eksik.test} test` : null,
          sonuc.eksik.acikUclu > 0 ? `${sonuc.eksik.acikUclu} klasik` : null,
        ]
          .filter(Boolean)
          .join(" ve ");

        toast.warning(`Seçtiğiniz kapsamda ${eksikler} soru eksik`, {
          description: "Sınav elde edilen sorularla kurulacak.",
        });
      }

      if (ids.length === 0) {
        toast.error("Bu kapsamda uygun soru yok", {
          description: "Konu seçimini genişletin veya soru sayısını düşürün.",
        });
        return;
      }
    }

    const dakika = Number.parseInt(sure.trim(), 10);

    /*
      "Ders atanmamis" bir ders ADI DEGIL, dersi girilmemis sorularin
      toplandigi yer tutucudur (bkz. lib/question-pool.ts). Oldugu gibi
      gonderilseydi sinavin gercek dersi olarak kaydedilir, oradan
      `getSubjectOptions` uzerinden ders listesine sizip ders YETKI
      sisteminde var olmayan bir ders gibi davranmaya baslardi.
    */
    const gecerliDers = ders === UNASSIGNED_SUBJECT ? "" : ders;

    setPending(true);

    try {
      const result = await createExamWithQuestions({
        title: baslik,
        description: gecerliDers
          ? `${gecerliDers} dersinden hazırlandı.`
          : "Soru havuzundan hazırlandı.",
        ...(gecerliDers ? { subject: gecerliDers } : {}),
        ...(Number.isFinite(dakika) ? { durationMinutes: dakika } : {}),
        questionIds: ids,
      });

      if (!result.ok) throw new Error(result.error);

      toast.success("Sınav hazır", {
        description: `${result.data.added} soru eklendi, puanlar 100 üzerinden dağıtıldı.`,
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
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Sınav oluştur
          </DialogTitle>
          <DialogDescription>
            Dersi ve kaç soru istediğinizi söyleyin; sınav konular arasında
            dengeli dağıtılarak hazırlansın.
          </DialogDescription>
        </DialogHeader>

        {/*
          Iki sutun: sol tarafta sinavin kimligi ve zamani, sagda kapsam
          (ders + konular). Tek sutunda konu listesi asagida kaliyor,
          egitmen soru sayisini girerken hangi konularin secili oldugunu
          goremiyordu.
        */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-5">
          {/* ---------- Başlık ---------- */}
          <div className="space-y-2">
            <Label htmlFor="compose-title">Sınav adı</Label>
            <Input
              id="compose-title"
              value={baslik}
              onChange={(event) => setBaslik(event.target.value)}
              placeholder="Elektronik ve IoT 1. Dönem Yazılı"
              autoFocus
            />
          </div>

          {/* ---------- Süre ---------- */}
          <div className="space-y-2">
            <Label htmlFor="compose-sure" className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              Süre (dakika)
            </Label>
            <Input
              id="compose-sure"
              type="number"
              min={1}
              max={600}
              value={sure}
              onChange={(event) => setSure(event.target.value)}
              className="w-32"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Her öğrenci sınava başladığı andan itibaren bu süreyi alır.
            </p>
          </div>
          </div>

          <div className="space-y-5">
              {/* ---------- Ders ---------- */}
              <div className="space-y-2">
                <Label htmlFor="compose-ders">Ders</Label>
                <Select
                  value={ders}
                  onValueChange={(value) => {
                    setDers(value);
                    // Ders degisince onceki konu secimi anlamsiz kalir.
                    setKonular(new Set());
                  }}
                >
                  <SelectTrigger id="compose-ders">
                    <SelectValue placeholder="Ders seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((group) => {
                      const sayim = countTopicsByType(group.topics);

                      return (
                        <SelectItem key={group.subject} value={group.subject}>
                          {group.subject} · {sayim.test} test · {sayim.acikUclu}{" "}
                          klasik
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* ---------- Zorluk ---------- */}
              <div className="space-y-2">
                <Label htmlFor="compose-zorluk">Zorluk</Label>
                <Select
                  value={zorluk}
                  onValueChange={(value) =>
                    setZorluk(value as "hepsi" | QuestionDifficulty)
                  }
                >
                  <SelectTrigger id="compose-zorluk">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kolay">Kolay</SelectItem>
                    <SelectItem value="orta">Orta</SelectItem>
                    <SelectItem value="zor">Zor</SelectItem>
                    <SelectItem value="hepsi">Fark etmez (karışık)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {zorluk === "hepsi"
                    ? "Kapsamdaki tüm sorular kullanılabilir."
                    : `Yalnızca ${DIFFICULTY_LABELS[zorluk].toLocaleLowerCase("tr")} sorulardan kurulur.`}
                </p>
              </div>

              {/* ---------- Konular (istege bagli, coklu) ---------- */}
              {acikDers ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>
                      Konular{" "}
                      <span className="font-normal text-muted-foreground">
                        (isteğe bağlı)
                      </span>
                    </Label>

                    {konular.size > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setKonular(new Set())}
                      >
                        Seçimi temizle
                      </Button>
                    ) : null}
                  </div>

                  <div className="max-h-[38vh] space-y-0.5 overflow-y-auto rounded-lg border p-2">
                    {acikDers.topics.map((topic) => {
                      const id = `konu-${topic.topic}`;
                      const secili = konular.has(topic.topic);
                      const sayim = countByType(topic.questions);

                      return (
                        <label
                          key={topic.topic}
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                            secili ? "bg-primary/5" : "hover:bg-accent/60",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={secili}
                            onChange={() => konuDegistir(topic.topic)}
                          />
                          <span className="min-w-0 flex-1 text-sm">{topic.topic}</span>

                          {/* Konu basina tip dagilimi: egitmen hangi konuda
                              klasik soru oldugunu gormeden secim yapamiyordu. */}
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium">
                            {sayim.test > 0 ? (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                                {sayim.test} test
                              </span>
                            ) : null}
                            {sayim.acikUclu > 0 ? (
                              <span className="rounded-full bg-highlight/15 px-1.5 py-0.5 text-highlight-foreground dark:text-highlight">
                                {sayim.acikUclu} klasik
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {konular.size === 0
                      ? `Konu seçmezseniz ${acikDers.subject} dersinin tüm konuları kapsama girer.`
                      : `${konular.size} konu seçildi.`}
                  </p>
                </div>
              ) : null}

              {/* ---------- Soru sayilari ---------- */}
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compose-test" className="flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                    Test sorusu
                  </Label>
                  <Input
                    id="compose-test"
                    type="number"
                    min={0}
                    value={testSayisi}
                    onChange={(event) => setTestSayisi(event.target.value)}
                  />
                  <p
                    className={cn(
                      "text-xs",
                      istenenTest > mevcut.test
                        ? "font-medium text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    Kapsamda {mevcut.test} test sorusu var
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compose-klasik" className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Klasik (açık uçlu)
                  </Label>
                  <Input
                    id="compose-klasik"
                    type="number"
                    min={0}
                    value={klasikSayisi}
                    onChange={(event) => setKlasikSayisi(event.target.value)}
                  />
                  <p
                    className={cn(
                      "text-xs",
                      istenenKlasik > mevcut.acik
                        ? "font-medium text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground",
                    )}
                  >
                    Kapsamda {mevcut.acik} klasik soru var
                  </p>
                </div>
              </div>

          {/* ---------- Özet ---------- */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Sınav:</span>
            <Badge variant="soft">
              {toplamIstenen} soru
            </Badge>
            <Badge variant="soft">{sure || "60"} dk</Badge>
            {ders ? (
              <Badge variant="soft">{ders}</Badge>
            ) : null}
            {zorluk === "hepsi" ? null : (
              <Badge variant="soft">{DIFFICULTY_LABELS[zorluk]}</Badge>
            )}
            {konular.size > 0 ? (
              <Badge variant="soft">{konular.size} konu</Badge>
            ) : null}

            {istenenTest > mevcut.test || istenenKlasik > mevcut.acik ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                <TriangleAlert className="h-3.5 w-3.5" />
                Kapsam yetersiz
              </span>
            ) : null}
          </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button disabled={!gecerli || pending || !canPersist} onClick={() => void olustur()}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Sınavı oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

