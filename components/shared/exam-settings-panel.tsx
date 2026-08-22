"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Camera,
  Check,
  Clock3,
  Loader2,
  Scale,
  Settings2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  resetExamPoints,
  setExamSubject,
  updateExamSettings,
} from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Sinav ayarlari.
 *
 * Ders, sure ve kamera zorunlulugu tek panelde toplandi. Onceden ders ayri
 * bir kartta, kamera ise "Siniflara ata" panelinin icindeydi; egitmen ayni
 * sinavin ayarlarini uc ayri yerde ariyordu.
 *
 * Her ayar KENDI basina kaydedilir (anahtar tiklaninca, alan kaydedilince).
 * Tek bir "Kaydet" dugmesi olsaydi, kaydetmeden ayrilan egitmenin
 * degisiklikleri sessizce kaybolurdu.
 */

export interface ExamSettingsPanelProps {
  examId: string;
  subject: string | null;
  durationMinutes: number | null;
  proctored: boolean;
  /** Secilebilir ders adlari; soru havuzundan turetilir. */
  subjectOptions?: readonly string[];
  /** Sinavdaki toplam puan; sure alaninin yaninda ozet olarak gosterilir. */
  totalPoints?: number;
  questionCount?: number;
  /** Puanlar soru sayisina gore kendiliginden mi dagitiliyor? */
  pointsAuto?: boolean;
  canPersist?: boolean;
}

export function ExamSettingsPanel({
  examId,
  subject,
  durationMinutes,
  proctored,
  subjectOptions = [],
  totalPoints = 0,
  questionCount = 0,
  pointsAuto = true,
  canPersist = true,
}: ExamSettingsPanelProps) {
  const router = useRouter();

  const [kamera, setKamera] = React.useState(proctored);
  const [sure, setSure] = React.useState(
    durationMinutes === null ? "" : String(durationMinutes),
  );
  const [ders, setDers] = React.useState(subject ?? "");
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => setKamera(proctored), [proctored]);
  React.useEffect(
    () => setSure(durationMinutes === null ? "" : String(durationMinutes)),
    [durationMinutes],
  );
  React.useEffect(() => setDers(subject ?? ""), [subject]);

  const sureDirty = sure.trim() !== (durationMinutes === null ? "" : String(durationMinutes));
  const dersDirty = ders.trim() !== (subject ?? "");

  function demoUyarisi() {
    toast.error("Tanıtım modunda kayıt yapılmaz");
  }

  async function kamerayiDegistir(deger: boolean) {
    if (!canPersist) return demoUyarisi();

    // Once ekranda degistir: anahtar tiklamaya aninda yanit vermeli.
    setKamera(deger);
    setPending("kamera");

    try {
      const result = await updateExamSettings(examId, { proctored: deger });
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.proctored
          ? "Kamera zorunluluğu açıldı"
          : "Kamera zorunluluğu kaldırıldı",
      );
      router.refresh();
    } catch (caught) {
      setKamera(!deger);
      toast.error("Ayar kaydedilemedi", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  async function sureyiKaydet() {
    if (!canPersist) return demoUyarisi();

    const ham = sure.trim();
    const deger = ham === "" ? null : Number.parseInt(ham, 10);

    if (deger !== null && (!Number.isFinite(deger) || deger < 1 || deger > 600)) {
      toast.error("Süre 1 ile 600 dakika arasında olmalı");
      return;
    }

    setPending("sure");

    try {
      const result = await updateExamSettings(examId, { durationMinutes: deger });
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.durationMinutes === null
          ? "Süre sınırı kaldırıldı"
          : `Süre: ${result.data.durationMinutes} dakika`,
      );
      router.refresh();
    } catch (caught) {
      toast.error("Süre kaydedilemedi", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  async function puanlariEsitle() {
    if (!canPersist) return demoUyarisi();

    setPending("puan");

    try {
      const result = await resetExamPoints(examId);
      if (!result.ok) throw new Error(result.error);

      toast.success("Puanlar eşit dağıtıldı", {
        description: `Toplam ${result.data.total} puan.`,
      });
      router.refresh();
    } catch (caught) {
      toast.error("Puanlar dağıtılamadı", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  async function dersiKaydet() {
    if (!canPersist) return demoUyarisi();

    setPending("ders");

    try {
      const result = await setExamSubject(examId, ders);
      if (!result.ok) throw new Error(result.error);

      toast.success(
        result.data.subject ? `Ders: ${result.data.subject}` : "Ders bilgisi kaldırıldı",
      );
      router.refresh();
    } catch (caught) {
      toast.error("Ders kaydedilemedi", {
        description: caught instanceof Error ? caught.message : "Tekrar deneyin.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4.5 w-4.5 text-primary" />
          Sınav ayarları
        </CardTitle>
        <CardDescription>
          Ders, süre ve kamera kuralı. Her ayar kaydettiğiniz anda geçerli olur.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          {/* ---------- Ders ---------- */}
          <div className="space-y-2">
            <Label htmlFor="ayar-ders" className="flex items-center gap-1.5">
              <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
              Ders
            </Label>

            <div className="flex gap-1.5">
              <Input
                id="ayar-ders"
                list="ayar-ders-secenekleri"
                value={ders}
                onChange={(event) => setDers(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && dersDirty) void dersiKaydet();
                }}
                placeholder="Biyoloji"
                autoComplete="off"
                disabled={pending !== null}
              />
              <datalist id="ayar-ders-secenekleri">
                {subjectOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>

              <KaydetDugmesi
                dirty={dersDirty}
                busy={pending === "ders"}
                disabled={pending !== null}
                onClick={() => void dersiKaydet()}
                label="Dersi kaydet"
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {subject
                ? "Sınavı yalnızca bu derse yetkili eğitmenler ve sınav sahibi görür."
                : "Ders atanmadığı için sınav tüm eğitmenlere açık."}
            </p>
          </div>

          {/* ---------- Süre ---------- */}
          <div className="space-y-2">
            <Label htmlFor="ayar-sure" className="flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              Süre (dakika)
            </Label>

            <div className="flex gap-1.5">
              <Input
                id="ayar-sure"
                type="number"
                min={1}
                max={600}
                inputMode="numeric"
                value={sure}
                onChange={(event) => setSure(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && sureDirty) void sureyiKaydet();
                }}
                placeholder="Sınırsız"
                disabled={pending !== null}
              />

              <KaydetDugmesi
                dirty={sureDirty}
                busy={pending === "sure"}
                disabled={pending !== null}
                onClick={() => void sureyiKaydet()}
                label="Süreyi kaydet"
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {durationMinutes === null
                ? "Süre sınırı yok; yalnızca sınavın açık olduğu tarih aralığı geçerli."
                : `Her öğrenci sınava başladığı andan itibaren ${durationMinutes} dakika alır. Tarih aralığı daha önce biterse o bağlar.`}
            </p>
          </div>
        </div>

        {/* ---------- Kamera ---------- */}
        <label
          htmlFor="ayar-kamera"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
            kamera ? "border-primary/50 bg-primary/5" : "hover:bg-accent/40",
          )}
        >
          <Checkbox
            id="ayar-kamera"
            checked={kamera}
            disabled={pending !== null || !canPersist}
            onChange={(event) => void kamerayiDegistir(event.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Camera className="h-3.5 w-3.5" />
              Kamera zorunlu olsun
              {pending === "kamera" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Açarsanız öğrenci sınava ancak kamerası ve mikrofonu açıkken
              girebilir; soruları tek tek geçer. Görüntü ve ses kaydedilmez,
              yalnızca sınav boyunca açık kalması gerekir.
            </span>
          </span>
        </label>

        {/* ---------- Puan özeti ---------- */}
        <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {questionCount} soru · toplam{" "}
              {/* Toplamin 100 olmasi zorunlu degil; 50 puanlik bir sinav da
                  gecerli. 100 yalnizca esit dagitimin varsayilani. */}
              <span className="font-semibold text-foreground">{totalPoints}</span>{" "}
              puan
            </span>

            <div className="flex items-center gap-2">
              <Badge variant={pointsAuto ? "soft" : "warning"}>
                {pointsAuto ? "Otomatik dağıtım" : "Elle ayarlandı"}
              </Badge>

              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={pending !== null || questionCount === 0}
                onClick={() => void puanlariEsitle()}
              >
                {pending === "puan" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Scale className="h-3.5 w-3.5" />
                )}
                Eşit dağıt
              </Button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {questionCount === 0 ? (
              "Sınava soru ekleyince puanlar 100 üzerinden kendiliğinden dağıtılır."
            ) : pointsAuto ? (
              <>
                Puanlar soru sayısına göre kendiliğinden dağıtılıyor; soru
                ekleyip çıkardıkça güncellenir. Bir soruya elle puan verirseniz
                otomatik dağıtım kapanır.
              </>
            ) : (
              <span className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Puanları elle ayarladınız; soru ekleyip çıkarmak puanları
                değiştirmez. Otomatik dağıtıma dönmek için &quot;Eşit
                dağıt&quot;a basın.
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

/** Yalnizca deger degistiginde etkinlesen kaydetme dugmesi. */
function KaydetDugmesi({
  dirty,
  busy,
  disabled,
  onClick,
  label,
}: {
  dirty: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      size="icon"
      variant={dirty ? "default" : "ghost"}
      className="shrink-0"
      disabled={!dirty || disabled}
      onClick={onClick}
      aria-label={label}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </Button>
  );
}
