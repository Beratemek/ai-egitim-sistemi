"use client";

import * as React from "react";
import {
  AlertTriangle,
  Clock,
  Loader2,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  estimateSimulationCalls,
  type DifficultyVerdictCode,
  type ExamSimulationReport,
  type SimulatedQuestionResult,
  type SimulationQuestionWarning,
} from "@/lib/exam-simulation";
import { PRESET_PROFILES, TWIN_DEFAULTS } from "@/lib/student-profiles";
import type { ExamCalibrationData } from "@/lib/queries";
import type {
  ApiResponse,
  ManualProfileInput,
  SimulationCohortInput,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Etiketler                                                                 */
/* -------------------------------------------------------------------------- */

const QUESTION_WARNING_LABELS: Readonly<
  Record<SimulationQuestionWarning, { label: string; variant: "danger" | "warning" }>
> = {
  cok_kolay: { label: "Çok kolay", variant: "warning" },
  cok_zor: { label: "Çok zor", variant: "warning" },
  ters_ayirt_edicilik: { label: "Ters çalışıyor", variant: "danger" },
  dusuk_ayirt_edicilik: { label: "Ayırt etmiyor", variant: "warning" },
};

/** Zorluk yargisinin ekranda gorunen karsiligi. */
const ZORLUK_ETIKET: Readonly<Record<DifficultyVerdictCode, string>> = {
  ideal: "İdeal",
  kolay: "Kolay",
  zor: "Zor",
  belirsiz: "Belirsiz",
};

const SEVERITY_VARIANT: Readonly<
  Record<"yuksek" | "orta" | "dusuk", "danger" | "warning" | "soft">
> = {
  yuksek: "danger",
  orta: "warning",
  dusuk: "soft",
};

/** Elle kadro kurarken yeni profilin baslangic degerleri. */
const YENI_PROFIL: ManualProfileInput = {
  label: "Yeni profil",
  ability: 0.6,
  diligence: 0.7,
  count: 5,
};

/**
 * Elle kadronun baslangic ayari - tipik bir sinif.
 *
 * DORT PROFIL, 24 OGRENCI. Sayilar rastgele degil, kestirimin cevaplamasi
 * gereken soruya gore secildi: "bu sinav ideal zorlukta mi?"
 *
 *   Guclu (4 kisi)    - TAVAN olcer. Bu grup da dusuyorsa sinav kazanimin
 *                       otesini soruyordur.
 *   Ortalama (12 kisi)- REFERANS. Zorluk yargisi bu profilin puanina bakar
 *                       (bkz. REFERENCE_ABILITY); sinif ortalamasi kadronun
 *                       bilesimine gore kayar, bu kaymaz. Sinifin govdesi
 *                       oldugu icin agirligi da en yuksek.
 *   Zorlanan (6 kisi) - TABAN olcer. Bu grup basariliysa sinav kolaydir;
 *                       ayrica ayirt ediciligin alt capasi.
 *   Aceleci (2 kisi)  - TUZAK olcer. Konuyu bilir ama hizli okur; yalnizca
 *                       ifadesi mugklak ya da tuzakli sorularda duser.
 *                       Dikkati dusuk oldugu icin ayirt edicilik hesabina
 *                       girmez (bkz. groupFromAbility).
 *
 * Kullanici bunlari serbestce degistirebilir; satir silmek cagri sayisini da
 * dusurur ve o sayi dugmenin yaninda canli yazar.
 */
const VARSAYILAN_PROFILLER: ManualProfileInput[] = [
  { label: "Güçlü öğrenciler", ability: 0.85, diligence: 0.85, count: 4 },
  { label: "Ortalama öğrenciler", ability: 0.6, diligence: 0.7, count: 12 },
  { label: "Zorlanan öğrenciler", ability: 0.32, diligence: 0.55, count: 6 },
  { label: "Aceleci öğrenciler", ability: 0.72, diligence: 0.25, count: 2 },
];

export interface ExamSimulationPanelProps {
  examId: string;
  /** Sinif adi ve mevcudu; dijital ikiz secimi icin. */
  classrooms: readonly { name: string; studentCount: number }[];
  /** Sinavin dersleri; elle profilde ders bazli yetkinlik icin. */
  subjects: readonly string[];
  questionCount: number;
  /** Acik uclu soru sayisi; her biri bir puanlama cagrisi ekler. */
  openEndedCount: number;
  durationMinutes: number | null;
  /** Gecmis kestirimlerin gercek sonuclarla karsilastirmasi. */
  calibration: ExamCalibrationData;
  canPersist?: boolean;
}

/**
 * Sinav kestirimi paneli.
 *
 * Egitmenin sordugu soru sudur: "bu sinavi bu sinifa versem ne olur?" Panel
 * uc yoldan kadro kurup sinavi simule ediyor ve puan dagilimi, soru bazinda
 * tahmin, kazanim kirilimi ve sure uyumu donduruyor.
 *
 * MUTLAK PUAN ONE CIKARILMIYOR. Dil modelinin "ortalama 68 olur" demesi
 * guvenilir degil; guvenilir olan siralama ve ayrisma. Bu yuzden ortalamanin
 * yaninda her zaman dagilim, ayrisma ve soru siralamasi duruyor, altta da
 * bunu acikca soyleyen bir not var. Yaniltici tek bir sayi gostermektense
 * neyin ne kadar guvenilir oldugunu soylemek dogru.
 */
export function ExamSimulationPanel({
  examId,
  classrooms,
  subjects,
  questionCount,
  openEndedCount,
  durationMinutes,
  calibration,
  canPersist = true,
}: ExamSimulationPanelProps) {
  const [kadroTuru, setKadroTuru] = React.useState<"hazir" | "ikiz" | "elle">("hazir");
  const [classroom, setClassroom] = React.useState(classrooms[0]?.name ?? "");
  const [profiller, setProfiller] = React.useState<ManualProfileInput[]>(
    VARSAYILAN_PROFILLER,
  );
  const [pending, setPending] = React.useState(false);
  const [report, setReport] = React.useState<ExamSimulationReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function cohortInput(): SimulationCohortInput {
    if (kadroTuru === "ikiz") return { kind: "ikiz", classroom };
    if (kadroTuru === "elle") return { kind: "elle", profiles: profiller };
    return { kind: "hazir" };
  }

  /*
    Kestirim, tek bir soru uretiminden ON KAT pahalidir: her profil sinavi
    bastan sona cozer. Kullanici bunu dugmeye BASMADAN once bilmeli - aksi
    halde ucretsiz katmanda kotasinin neden bittigini anlayamaz.

    Profil sayisi kadro turune gore: hazir takim sabit, elle kurulanda satir
    sayisi, ikizde dilim sayisi kadar (gercek sayi sunucuda cikiyor, burada
    varsayilan dilim sayisi kullaniliyor).
  */
  const profilSayisi =
    kadroTuru === "elle"
      ? profiller.length
      : kadroTuru === "ikiz"
        ? TWIN_DEFAULTS.size
        : PRESET_PROFILES.length;

  const tahminiCagri = estimateSimulationCalls({
    profileCount: profilSayisi,
    questionCount,
    openEndedCount,
  });

  async function calistir() {
    if (!canPersist) {
      toast.error("Kestirim tanıtım modunda kullanılamaz.");
      return;
    }
    if (kadroTuru === "ikiz" && !classroom) {
      toast.error("Önce bir sınıf seçin.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/simulate-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, cohort: cohortInput() }),
      });

      const payload = (await response.json()) as ApiResponse<ExamSimulationReport>;
      if (!payload.ok) throw new Error(payload.error);

      setReport(payload.data);
      toast.success("Kestirim hazır", {
        description: `Tahmini ortalama %${payload.data.distribution.mean}.`,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Kestirim tamamlanamadı.";
      setError(message);
      toast.error("Kestirim başarısız", { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Sınıf kestirimi
          </CardTitle>
          <CardDescription>
            Sınavı yayına almadan önce simüle bir sınıfa çözdürün: ortalama ne çıkar,
            sınıf ayrışır mı, hangi kazanımda düşülür, süre yeter mi.
            {questionCount > 0 ? ` ${questionCount} soru simüle edilecek.` : null}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs
            value={kadroTuru}
            onValueChange={(value) => setKadroTuru(value as typeof kadroTuru)}
          >
            <TabsList>
              <TabsTrigger value="hazir">Hazır kadro</TabsTrigger>
              <TabsTrigger value="ikiz">Gerçek sınıf</TabsTrigger>
              <TabsTrigger value="elle">Kendim kurayım</TabsTrigger>
            </TabsList>

            <TabsContent value="hazir" className="mt-3">
              <p className="text-sm text-muted-foreground">
                Güçlüden zorlanana beş zıt profilden oluşan karma bir sınıf. Belirli bir
                sınıfı hedeflemeden &quot;sınav genel olarak nasıl işliyor&quot; sorusuna
                hızlı cevap verir.
              </p>
            </TabsContent>

            <TabsContent value="ikiz" className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Seçilen sınıfın <strong>geçmiş sonuçlarından</strong> kadro türetilir:
                öğrenciler yetkinlik dilimlerine ayrılır, her dilim bir temsilciyle ve
                dilimdeki öğrenci sayısı kadar ağırlıkla simüle edilir. Öğrenci adı ya da
                kimliği yapay zekâya gönderilmez.
              </p>

              {classrooms.length === 0 ? (
                <p className="text-sm text-warning">
                  Henüz sınıfı olan öğrenci yok. Sistem yöneticisi öğrencilere sınıf
                  atadıktan sonra bu seçenek kullanılabilir.
                </p>
              ) : (
                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor="kestirim-sinif">Sınıf</Label>
                  <Select value={classroom} onValueChange={setClassroom}>
                    <SelectTrigger id="kestirim-sinif">
                      <SelectValue placeholder="Sınıf seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {classrooms.map((item) => (
                        <SelectItem key={item.name} value={item.name}>
                          {item.name} ({item.studentCount} öğrenci)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            <TabsContent value="elle" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Sınıfınızı tarif edin: her profil için düzey, dikkat ve kaç öğrenci
                olduğunu belirtin. Ders bazında düzey verirseniz &quot;matematikte iyi,
                fizikte zayıf&quot; bir sınıf da kurabilirsiniz.
              </p>

              <ul className="space-y-3">
                {profiller.map((profil, index) => (
                  <ProfilSatiri
                    key={index}
                    profil={profil}
                    subjects={subjects}
                    silinebilir={profiller.length > 1}
                    onChange={(next) =>
                      setProfiller((current) =>
                        current.map((item, i) => (i === index ? next : item)),
                      )
                    }
                    onDelete={() =>
                      setProfiller((current) => current.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </ul>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={profiller.length >= 8}
                onClick={() => setProfiller((current) => [...current, { ...YENI_PROFIL }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Profil ekle
              </Button>
            </TabsContent>
          </Tabs>

          {error ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="gap-1.5"
              disabled={pending || questionCount === 0}
              title={questionCount === 0 ? "Önce sınava soru ekleyin" : undefined}
              onClick={() => void calistir()}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {pending
                ? "Sınıf sınavı çözüyor…"
                : report
                  ? "Yeniden çalıştır"
                  : "Kestirimi çalıştır"}
            </Button>

            {questionCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                Yaklaşık <strong>{tahminiCagri}</strong> yapay zekâ isteği yapılacak
                {profilSayisi > 5
                  ? " — profil sayısını azaltarak düşürebilirsiniz."
                  : "."}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <KalibrasyonSeridi calibration={calibration} />

      {report ? <SonucGorunumu report={report} durationMinutes={durationMinutes} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Kalibrasyon                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Kestirimin gecmiste ne kadar tuttugu.
 *
 * OZELLIGIN KENDI DOGRULUGUNU GOSTERDIGI YER. Bir tahmin, tutup tutmadigi
 * olculmedigi surece guvenilir de guvenilmez de sayilamaz; burada her kestirim
 * sinav yapildiktan sonra gercek ortalamayla karsilastiriliyor ve ortalama
 * sapma acikca yaziliyor. Sapma buyuk ciksa da gosteriliyor - gizlemek,
 * kullanicinin tahmine hak etmedigi bir guven duymasina yol acardi.
 */
function KalibrasyonSeridi({ calibration }: { calibration: ExamCalibrationData }) {
  if (!calibration.available) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Kalibrasyon kapalı: kestirim kayıtları için{" "}
        <code className="rounded bg-muted px-1 py-0.5">
          supabase/migrations/BEKLEYEN-1-sinav-kestirimi.sql
        </code>{" "}
        henüz uygulanmamış. Kestirim yine de çalışır, yalnızca tahmin-gerçek
        karşılaştırması birikmez.
      </p>
    );
  }

  const { summary, latest } = calibration;
  if (!summary && !latest) return null;

  const sapma =
    latest && latest.actual !== null
      ? Math.round(Math.abs(latest.predicted - latest.actual) * 10) / 10
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Kestirim ne kadar tutuyor?
        </CardTitle>
        <CardDescription>
          Yapılan tahminler, sınav gerçekleşip puanlar onaylandıktan sonra gerçek
          ortalamayla karşılaştırılır.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {summary ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metrik
              baslik="Ortalama sapma"
              deger={"\u00b1" + summary.meanAbsoluteError}
              alt={summary.count + " ölçülmüş kestirim"}
            />
            <Metrik
              baslik="10 puan içinde"
              deger={"%" + Math.round(summary.within10 * 100)}
              alt="isabetli sayılan tahminler"
            />
            <Metrik
              baslik="Yönelim"
              deger={summary.bias > 0 ? "+" + summary.bias : String(summary.bias)}
              alt={
                summary.bias > 1
                  ? "fazla iyimser"
                  : summary.bias < -1
                    ? "fazla karamsar"
                    : "yansız"
              }
            />
            <Metrik baslik="En kötü sapma" deger={String(summary.worst)} alt="puan" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Henüz ölçülmüş kestirim yok. Kestirim yapılan bir sınav uygulanıp puanları
            onaylandığında tahmin ile gerçek burada yan yana görünecek.
          </p>
        )}

        {latest ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm">
            <strong>Bu sınav:</strong>{" "}
            {latest.actual === null || sapma === null ? (
              <>
                son tahmin %{latest.predicted} ({latest.cohortLabel}). Sonuçlar
                onaylandığında karşılaştırma buraya düşecek.
              </>
            ) : (
              <>
                tahmin %{latest.predicted} → gerçek %{latest.actual} ({latest.studentCount}{" "}
                öğrenci){" "}
                <Badge variant={sapma < 10 ? "success" : "warning"} className="ml-1">
                  {sapma} puan sapma
                </Badge>
              </>
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Elle profil satiri                                                        */
/* -------------------------------------------------------------------------- */

function ProfilSatiri({
  profil,
  subjects,
  silinebilir,
  onChange,
  onDelete,
}: {
  profil: ManualProfileInput;
  subjects: readonly string[];
  silinebilir: boolean;
  onChange: (next: ManualProfileInput) => void;
  onDelete: () => void;
}) {
  const [dersAcik, setDersAcik] = React.useState(
    Object.keys(profil.subjectAbility ?? {}).length > 0,
  );

  return (
    <li className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label className="text-xs">Profil adı</Label>
          <Input
            value={profil.label}
            onChange={(event) => onChange({ ...profil, label: event.target.value })}
          />
        </div>

        <div className="w-24 space-y-1.5">
          <Label className="text-xs">Öğrenci</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={profil.count}
            onChange={(event) =>
              onChange({ ...profil, count: Number(event.target.value) || 1 })
            }
          />
        </div>

        {silinebilir ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label={`${profil.label} profilini sil`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OranAyari
          label="Düzey"
          hint="Kazanımı ne kadar biliyor"
          value={profil.ability}
          onChange={(ability) => onChange({ ...profil, ability })}
        />
        <OranAyari
          label="Dikkat"
          hint="1'e yakın: titiz · 0'a yakın: aceleci"
          value={profil.diligence}
          onChange={(diligence) => onChange({ ...profil, diligence })}
        />
      </div>

      {subjects.length > 1 ? (
        <div className="space-y-2">
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setDersAcik((open) => !open)}
          >
            {dersAcik ? "Ders bazlı düzeyi gizle" : "Ders bazlı düzey ver"}
          </button>

          {dersAcik ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {subjects.map((subject) => (
                <OranAyari
                  key={subject}
                  label={subject}
                  hint="Boş bırakılırsa genel düzey geçerli"
                  value={profil.subjectAbility?.[subject] ?? profil.ability}
                  onChange={(value) =>
                    onChange({
                      ...profil,
                      subjectAbility: { ...profil.subjectAbility, [subject]: value },
                    })
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * 0-1 arasi bir orani yuzde olarak ayarlayan kaydirac.
 *
 * Kaydirac icin ayri bir bilesen eklenmedi: tek bir `input[type=range]` ayni
 * isi goruyor ve tema rengini `accent-color` ile aliyor. Yeni bir Radix
 * bagimliligi, bu tek kullanim icin fazla olurdu.
 */
function OranAyari({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-semibold tabular-nums">
          %{Math.round(value * 100)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--primary))]"
        aria-label={label}
      />
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sonuc                                                                     */
/* -------------------------------------------------------------------------- */

function SonucGorunumu({
  report,
  durationMinutes,
}: {
  report: ExamSimulationReport;
  durationMinutes: number | null;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{report.cohortLabel}</CardTitle>
          <CardDescription>
            {report.studentCount} öğrenci · {report.questions.length} soru ·{" "}
            {report.totalPoints} puan
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {/*
              ZORLUK YARGISI EN BASTA: kestirimin cevapladigi asil soru
              "sinav ideal mi". Referans ogrencinin puanina bakiyor, sinif
              ortalamasina degil - ortalama kadroya kac zayif ogrenci
              konduguna gore kayar, sinav degismedigi halde.
            */}
            <Metrik
              baslik="Zorluk"
              deger={ZORLUK_ETIKET[report.difficultyCheck.code]}
              alt={
                report.difficultyCheck.referenceLabel
                  ? `${report.difficultyCheck.referenceLabel}: %${report.difficultyCheck.referenceScore}`
                  : "referans profil yok"
              }
              tone={report.difficultyCheck.code === "ideal" ? "default" : "warning"}
            />
            <Metrik
              baslik="Tahmini ortalama"
              deger={`%${report.distribution.mean}`}
              alt={`ortanca %${report.distribution.median} · sapma ${report.distribution.stdDev}`}
            />
            <Metrik
              baslik="Geçme oranı"
              deger={`%${Math.round(report.distribution.passRate * 100)}`}
              alt="50 ve üzeri alanlar"
            />
            <Metrik
              baslik="Ayrışma"
              deger={
                report.separation === null ? "-" : `${Math.round(report.separation)} puan`
              }
              alt="üst grup − alt grup"
            />
            <Metrik
              baslik="Süre"
              deger={
                durationMinutes === null
                  ? `${report.duration.slowestMinutes} dk`
                  : report.duration.fits
                    ? "Yeterli"
                    : "Yetmeyebilir"
              }
              alt={`en yavaş ${report.duration.slowestMinutes} dk${
                durationMinutes ? ` / ${durationMinutes} dk` : ""
              }`}
              tone={report.duration.fits === false ? "warning" : "default"}
            />
          </div>

          <PuanDagilimi report={report} />

          {report.warnings.length > 0 ? (
            <ul className="space-y-2">
              {report.warnings.map((warning) => (
                <li key={warning.code} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY_VARIANT[warning.severity]}>
                      {warning.severity === "yuksek"
                        ? "Yüksek"
                        : warning.severity === "orta"
                          ? "Orta"
                          : "Düşük"}
                    </Badge>
                    <span className="text-sm font-medium">{warning.title}</span>
                    {warning.questionNumbers.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Soru {warning.questionNumbers.join(", ")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {warning.detail}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success">
              <TrendingUp className="h-4 w-4" />
              Kestirimde yapısal bir sorun görünmüyor: sınav bu sınıfı ayrıştırıyor ve
              süre yeterli.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sınıf dilimleri</CardTitle>
            <CardDescription>Her satır kaç öğrenciyi temsil ediyor.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profil</TableHead>
                  <TableHead className="text-right">Öğrenci</TableHead>
                  <TableHead className="text-right">Puan</TableHead>
                  <TableHead className="text-right">Süre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...report.students]
                  .sort((a, b) => b.score - a.score)
                  .map((student) => (
                    <TableRow key={student.profileId}>
                      <TableCell className="font-medium">{student.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {student.weight}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {student.score}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {student.estimatedMinutes} dk
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kazanım kestirimi</CardTitle>
            <CardDescription>En zayıf kazanım en üstte.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.outcomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sorular kazanıma bağlanmamış; kazanım kırılımı çıkarılamıyor.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {report.outcomes.map((outcome) => (
                  <li key={outcome.outcomeId} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{outcome.outcomeText}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        %{outcome.averageScore}
                      </span>
                    </div>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          outcome.averageScore < 50
                            ? "bg-destructive"
                            : outcome.averageScore < 70
                              ? "bg-warning"
                              : "bg-success",
                        )}
                        style={{ width: `${outcome.averageScore}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Soru bazında kestirim</CardTitle>
          <CardDescription>
            Başarı oranı ve ayırt edicilik; riskli sorular işaretli.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Soru</TableHead>
                <TableHead className="text-right">Başarı</TableHead>
                <TableHead className="text-right">Ayırt</TableHead>
                <TableHead>En çok seçilen yanlış</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.questions.map((question) => (
                <SoruSatiri key={question.questionId} question={question} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/*
        Guvenilirlik notu SONUCLARIN ALTINDA, kucuk puntoda ama her zaman
        gorunur. Ustte olsaydi okunmadan gecilirdi; hic olmasaydi tek bir
        tahmini ortalama sayisi hak etmedigi bir kesinlikle okunurdu.
      */}
      <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Bu bir <strong>kestirim</strong>dir, ölçüm değil. Mutlak puan tahmini
          (&quot;ortalama %{report.distribution.mean} olur&quot;) sapma payı taşır;
          güvenilir olan <strong>sıralama ve ayrışma</strong>dır: hangi soru daha zor,
          sınav sınıfı ayırıyor mu, hangi kazanımda toplu düşüş var. Süre kestirimi metin
          uzunluğu ve soru tipinden hesaplanan şeffaf bir varsayımdır.
        </span>
      </p>
    </div>
  );
}

function PuanDagilimi({ report }: { report: ExamSimulationReport }) {
  const enBuyuk = Math.max(...report.distribution.buckets.map((bucket) => bucket.count), 1);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">Puan dağılımı</p>
      <div className="flex items-end gap-2">
        {report.distribution.buckets.map((bucket) => (
          <div key={bucket.from} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums">{bucket.count}</span>
            <span
              className={cn(
                "w-full rounded-t bg-primary/70",
                bucket.count === 0 && "bg-muted",
              )}
              style={{ height: `${Math.max(4, (bucket.count / enBuyuk) * 80)}px` }}
            />
            <span className="text-[10px] text-muted-foreground">
              {bucket.from}-{bucket.to}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoruSatiri({ question }: { question: SimulatedQuestionResult }) {
  return (
    <TableRow>
      <TableCell className="tabular-nums text-muted-foreground">
        {question.position}
      </TableCell>
      <TableCell className="max-w-[22rem]">
        <p className="truncate text-sm">{question.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{question.subject}</span>
          {question.warnings.map((warning) => (
            <Badge key={warning} variant={QUESTION_WARNING_LABELS[warning].variant}>
              {QUESTION_WARNING_LABELS[warning].label}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        %{Math.round(question.pDegeri * 100)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          question.ayirtEdicilik !== null &&
            question.ayirtEdicilik < 0 &&
            "font-semibold text-destructive",
        )}
      >
        {question.ayirtEdicilik === null ? "-" : question.ayirtEdicilik.toFixed(2)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {question.enCokSecilenYanlis ? (
          <span>
            <span className="font-mono">{question.enCokSecilenYanlis.key}</span> · %
            {Math.round(question.enCokSecilenYanlis.rate * 100)}
          </span>
        ) : (
          "-"
        )}
      </TableCell>
    </TableRow>
  );
}

function Metrik({
  baslik,
  deger,
  alt,
  tone = "default",
}: {
  baslik: string;
  deger: string;
  alt: string;
  tone?: "default" | "warning";
}) {
  return (
    <div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "warning" && "text-warning",
        )}
      >
        {deger}
      </p>
      <p className="text-xs font-medium">{baslik}</p>
      <p className="text-[11px] text-muted-foreground">{alt}</p>
    </div>
  );
}
