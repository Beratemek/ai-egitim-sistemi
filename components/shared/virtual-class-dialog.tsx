"use client";

import * as React from "react";
import {
  ArrowRight,
  Check,
  FlaskConical,
  Loader2,
  ShieldAlert,
  TriangleAlert,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeOptionKey } from "@/lib/answer-normalization";
import {
  buildRepairInstruction,
  personaById,
  type FindingSeverity,
  type QualityFinding,
  type StudentAgentAnswer,
  type VirtualClassReport,
  type VirtualClassVerdict,
} from "@/lib/student-agents";
import type { ApiResponse, GeneratedQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Etiketler                                                                 */
/* -------------------------------------------------------------------------- */

const VERDICT_META: Readonly<
  Record<VirtualClassVerdict, { label: string; variant: "success" | "warning" | "danger" }>
> = {
  hazir: { label: "Havuza hazır", variant: "success" },
  gozden_gecir: { label: "Gözden geçirin", variant: "warning" },
  revizyon: { label: "Revizyon gerekli", variant: "danger" },
};

const SEVERITY_META: Readonly<
  Record<FindingSeverity, { label: string; variant: "danger" | "warning" | "soft" }>
> = {
  yuksek: { label: "Yüksek", variant: "danger" },
  orta: { label: "Orta", variant: "warning" },
  dusuk: { label: "Düşük", variant: "soft" },
};

export interface VirtualClassDialogProps {
  question: GeneratedQuestion;
  /** Kaçıncı taslak - başlıkta görünür. */
  index: number;
  /** Simüle öğrencilerin "derste öğrendiği" kazanım. */
  kazanim?: string;
  /** Onarım revizyonunda modele bağlam olarak gider. */
  context?: string;
  subject?: string;
  /** Üretimde seçilen model; pilot da aynı modelle çalışsın diye taşınır. */
  model?: string;
  provider?: string;
  /** Onarılmış soruyu taslak listesine geri yazar. */
  onReplace?: (question: GeneratedQuestion) => void;
}

/**
 * Sanal sınıf pilot uygulaması diyaloğu.
 *
 * UC ADIM, HEPSI KULLANICININ ONAYIYLA:
 *
 *   1. "Pilotu başlat" - beş simüle öğrenci soruyu cevap anahtarını görmeden
 *      çözer; sonuçtan madde analizi raporu çıkar.
 *   2. "Bulgulara göre düzelt" - rapordaki bulgular tek bir revizyon
 *      talimatına çevrilir ve var olan revizyon ucuna gönderilir.
 *   3. Düzeltilmiş soru YENIDEN pilota sokulur; iki skor yan yana gösterilir.
 *
 * PILOT KENDILIGINDEN CALISMAZ. Diyalog açılınca otomatik başlasaydı, kartı
 * merak edip açan her kullanıcı farkında olmadan model kotası harcardı;
 * üstelik üretilen her taslak için bu maliyet katlanırdı.
 *
 * ONARIM SUNUCUDA DEGIL BURADA KURULUYOR: elde zaten rapor var, onu sunucuya
 * geri gönderip pilotu baştan çalıştırmak iki model çağrısını boşa harcamak
 * olurdu. `buildRepairInstruction` saf bir fonksiyon; talimatı burada üretip
 * var olan `/api/ai/revise-question` ucuna veriyoruz.
 */
export function VirtualClassDialog({
  question,
  index,
  kazanim,
  context,
  subject,
  model,
  provider,
  onReplace,
}: VirtualClassDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<"bos" | "pilot" | "onarim">("bos");
  const [report, setReport] = React.useState<VirtualClassReport | null>(null);
  const [repaired, setRepaired] = React.useState<{
    question: GeneratedQuestion;
    report: VirtualClassReport;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /** Ekranda gösterilen soru ve rapor: onarım varsa onarılmış sürüm. */
  const aktifSoru = repaired?.question ?? question;
  const aktifRapor = repaired?.report ?? report;

  async function pilotCalistir(target: GeneratedQuestion): Promise<VirtualClassReport> {
    const response = await fetch("/api/ai/virtual-class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: target,
        ...(kazanim ? { kazanim } : {}),
        ...(subject ? { subject } : {}),
        ...(model ? { model } : {}),
        ...(provider ? { provider } : {}),
      }),
    });

    const payload = (await response.json()) as ApiResponse<VirtualClassReport>;
    if (!payload.ok) throw new Error(payload.error);
    return payload.data;
  }

  async function handlePilot() {
    setPhase("pilot");
    setError(null);

    try {
      const sonuc = await pilotCalistir(question);
      setReport(sonuc);
      setRepaired(null);

      const bulgu = sonuc.bulgular.length;
      if (bulgu === 0) {
        toast.success("Sanal sınıf temiz", {
          description: "Beş öğrenci profili de soruyu sorunsuz çözdü.",
        });
      } else {
        toast.success(`Pilot tamamlandı - ${bulgu} bulgu`, {
          description: `Kalite skoru ${sonuc.kaliteSkoru}/100.`,
        });
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Pilot uygulama tamamlanamadı.";
      setError(message);
      toast.error("Pilot uygulama başarısız", { description: message });
    } finally {
      setPhase("bos");
    }
  }

  async function handleOnarim() {
    if (!report) return;

    const instruction = buildRepairInstruction(report);
    if (!instruction) {
      toast.info("Giderilecek bulgu yok");
      return;
    }

    setPhase("onarim");
    setError(null);

    try {
      const response = await fetch("/api/ai/revise-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          instruction,
          ...(kazanim ? { kazanim } : {}),
          ...(context ? { context } : {}),
        }),
      });

      const payload = (await response.json()) as ApiResponse<GeneratedQuestion>;
      if (!payload.ok) throw new Error(payload.error);

      // Duzeltilen soru YENIDEN olculur: "duzelttim" demek yetmez, kanit lazim.
      const yeniRapor = await pilotCalistir(payload.data);
      setRepaired({ question: payload.data, report: yeniRapor });

      const fark = yeniRapor.kaliteSkoru - report.kaliteSkoru;
      toast.success(
        fark > 0
          ? `Skor ${report.kaliteSkoru} → ${yeniRapor.kaliteSkoru}`
          : "Düzeltme skoru artırmadı",
        {
          description:
            fark > 0
              ? "Düzeltilmiş soruyu kullanabilirsiniz."
              : "Özgün soruyu korumak daha iyi olabilir.",
        },
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Düzeltme tamamlanamadı.";
      setError(message);
      toast.error("Düzeltme başarısız", { description: message });
    } finally {
      setPhase("bos");
    }
  }

  function kullan() {
    if (!repaired || !onReplace) return;
    onReplace(repaired.question);
    toast.success("Düzeltilmiş soru taslağa yazıldı");
    setOpen(false);
  }

  const calisiyor = phase !== "bos";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" />
          Sanal sınıf
          {report ? (
            <Badge variant={VERDICT_META[report.verdict].variant} className="ml-1">
              {(repaired?.report ?? report).kaliteSkoru}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {index + 1}. soru - sanal sınıf pilotu
          </DialogTitle>
          <DialogDescription>
            Beş farklı öğrenci profili bu soruyu <strong>cevap anahtarını görmeden</strong>{" "}
            çözer. Kim doğru bildi, kim nerede takıldı, hangi çeldirici işe yaradı - hepsi
            soru öğrenciye gitmeden ölçülür.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}

        {!aktifRapor ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground/50" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Pilot, gerçek bir sınıf denemesinin yerini tutar: madde güçlüğü, ayırt
              edicilik ve çeldirici dağılımı bu simülasyondan hesaplanır.
            </p>
            <Button className="gap-1.5" disabled={calisiyor} onClick={() => void handlePilot()}>
              {phase === "pilot" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {phase === "pilot" ? "Sınıf soruyu çözüyor…" : "Pilotu başlat"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {repaired && report ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
                <Wand2 className="h-4 w-4 text-success" />
                <span className="font-medium">Düzeltilmiş sürüm ölçüldü:</span>
                <span className="text-muted-foreground">{report.kaliteSkoru}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold text-success">
                  {repaired.report.kaliteSkoru}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({report.bulgular.length} bulgu → {repaired.report.bulgular.length} bulgu)
                </span>
              </div>
            ) : null}

            <SkorSeridi report={aktifRapor} />

            {aktifRapor.bulgular.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Bulgular ({aktifRapor.bulgular.length})
                </h3>
                <ul className="space-y-2">
                  {aktifRapor.bulgular.map((bulgu) => (
                    <BulguSatiri key={bulgu.code} bulgu={bulgu} />
                  ))}
                </ul>
              </section>
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-success">
                <Check className="h-4 w-4" />
                Sanal sınıf bu soruda ölçme sorunu bulmadı.
              </p>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Sınıfın cevapları</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {aktifRapor.cevaplar.map((cevap) => (
                  <PersonaKarti
                    key={cevap.personaId}
                    cevap={cevap}
                    question={aktifSoru}
                    rubrikPuani={
                      aktifRapor.rubrikPuanlari?.find(
                        (puan) => puan.personaId === cevap.personaId,
                      )?.score ?? null
                    }
                  />
                ))}
              </ul>
            </section>

            {aktifRapor.siklar.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Çeldirici dağılımı</h3>
                <ul className="space-y-1.5">
                  {aktifRapor.siklar.map((sik) => (
                    <li key={sik.key} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold",
                          sik.correct
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {sik.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {sik.text}
                      </span>
                      {/*
                        Bar genisligi 5 ogrenci uzerinden: `rate` zaten 0-1
                        araliginda ve yuzdeye cevrilebiliyor. Sifir secimde bar
                        gorunmez, sayi yine de yaziliyor.
                      */}
                      <span className="flex w-24 shrink-0 items-center gap-1.5">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              sik.correct ? "bg-success" : "bg-muted-foreground/50",
                            )}
                            style={{ width: `${Math.round(sik.rate * 100)}%` }}
                          />
                        </span>
                        <span className="w-4 text-right text-xs tabular-nums text-muted-foreground">
                          {sik.count}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {aktifRapor.ipucuSondasi ? (
              <section
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-sm",
                  aktifRapor.ipucuSondasi.sizinti
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/40",
                )}
              >
                <ShieldAlert
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    aktifRapor.ipucuSondasi.sizinti
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p className="font-medium">
                    {aktifRapor.ipucuSondasi.sizinti
                      ? "İpucu sızıntısı var"
                      : "İpucu sızıntısı yok"}
                  </p>
                  <p className="text-muted-foreground">
                    Konuyu bilmeyen öğrenci {normalizeOptionKey(aktifRapor.ipucuSondasi.guess)}{" "}
                    şıkkını seçti.{" "}
                    {aktifRapor.ipucuSondasi.cue
                      ? `Dayandığı biçimsel ipucu: ${aktifRapor.ipucuSondasi.cue}.`
                      : "Şıkların biçiminde tutunabileceği bir ipucu bulamadı."}
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={calisiyor}
            onClick={() => void handlePilot()}
          >
            {phase === "pilot" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {aktifRapor ? "Yeniden ölç" : "Pilotu başlat"}
          </Button>

          <div className="flex flex-wrap gap-2">
            {report && report.bulgular.length > 0 && !repaired ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={calisiyor}
                onClick={() => void handleOnarim()}
              >
                {phase === "onarim" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Bulgulara göre düzelt
              </Button>
            ) : null}

            {repaired && onReplace ? (
              <Button size="sm" className="gap-1.5" disabled={calisiyor} onClick={kullan}>
                <Check className="h-3.5 w-3.5" />
                Düzeltilmiş soruyu kullan
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Alt bilesenler                                                            */
/* -------------------------------------------------------------------------- */

/** Kalite skoru + uc temel madde analizi metrigi. */
function SkorSeridi({ report }: { report: VirtualClassReport }) {
  const verdict = VERDICT_META[report.verdict];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold tabular-nums">{report.kaliteSkoru}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>

      <Badge variant={verdict.variant}>{verdict.label}</Badge>

      <div className="ml-auto grid grid-cols-3 gap-4 text-center">
        <Metrik
          label="Güçlük (p)"
          value={report.pDegeri === null ? "-" : report.pDegeri.toFixed(2)}
          hint="Doğru cevaplayan oranı. 0,40-0,80 arası ideal kabul edilir."
        />
        <Metrik
          label="Ayırt edicilik"
          value={report.ayirtEdicilik === null ? "-" : report.ayirtEdicilik.toFixed(2)}
          hint="Konuyu bilen ile bilmeyen arasındaki başarı farkı. Yüksek ve pozitif olmalı."
        />
        <Metrik
          label="Belirsizlik"
          value={`${report.belirsizlikSayisi}/${report.cevaplar.length}`}
          hint="Soruyu belirsiz bulan öğrenci sayısı."
        />
      </div>
    </div>
  );
}

function Metrik({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div title={hint}>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BulguSatiri({ bulgu }: { bulgu: QualityFinding }) {
  const severity = SEVERITY_META[bulgu.severity];

  return (
    <li className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={severity.variant}>{severity.label}</Badge>
        <span className="text-sm font-medium">{bulgu.title}</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{bulgu.detail}</p>
    </li>
  );
}

/**
 * Tek bir ogrencinin cevabi.
 *
 * Dogru/yanlis isareti test sorusunda anahtar karsilastirmasindan, acik uclu
 * soruda rubrik puanindan geliyor. Gerekce her zaman gosteriliyor: bulgunun
 * KANITI o metinde, "guclu ogrenci B dedi" cumlesi tek basina bir sey
 * anlatmiyor.
 */
function PersonaKarti({
  cevap,
  question,
  rubrikPuani,
}: {
  cevap: StudentAgentAnswer;
  question: GeneratedQuestion;
  rubrikPuani: number | null;
}) {
  const persona = personaById(cevap.personaId);
  const dogru =
    question.type === "test" && question.correct_answer
      ? normalizeOptionKey(cevap.answer) === normalizeOptionKey(question.correct_answer)
      : rubrikPuani !== null
        ? rubrikPuani >= 60
        : null;

  return (
    <li
      className={cn(
        "rounded-lg border p-3",
        dogru === true && "border-success/40 bg-success/[0.03]",
        dogru === false && "border-destructive/25 bg-destructive/[0.03]",
      )}
    >
      <div className="flex items-center gap-2">
        {dogru === null ? null : dogru ? (
          <Check className="h-4 w-4 shrink-0 text-success" />
        ) : (
          <X className="h-4 w-4 shrink-0 text-destructive" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{persona.label}</span>

        {question.type === "test" ? (
          <Badge variant="outline" className="font-mono">
            {normalizeOptionKey(cevap.answer)}
          </Badge>
        ) : rubrikPuani !== null ? (
          <Badge variant="outline" className="tabular-nums">
            {Math.round(rubrikPuani)} puan
          </Badge>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{persona.summary}</p>

      {question.type === "acik_uclu" ? (
        <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs leading-relaxed">
          {cevap.answer}
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{cevap.reasoning}</p>

      <div className="mt-2 flex items-center gap-2">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-primary/60"
            style={{ width: `${Math.round(cevap.confidence)}%` }}
          />
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          güven %{Math.round(cevap.confidence)}
        </span>
      </div>

      {cevap.ambiguous && cevap.ambiguityNote ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {cevap.ambiguityNote}
        </p>
      ) : null}
    </li>
  );
}
